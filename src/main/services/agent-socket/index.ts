/**
 * Local agent-socket server. Listens on a Unix domain socket (POSIX) or named
 * pipe (Windows) inside the Electron main process and accepts JSON-RPC 2.0
 * requests from a single trusted client process — the bundled `vaxtly` CLI
 * (or its `vaxtly mcp` mode, which proxies to the same socket).
 *
 * No TCP listener. The transport surface is intentionally limited to a
 * file/pipe gated by OS permissions; auth is via a per-launch bearer token
 * stored alongside the socket path in `~/.vaxtly/cli.json` (0600).
 */

import { createServer, type Server, type Socket } from 'node:net'
import { createHash } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

import {
  ERR,
  LineBuffer,
  encodeFrame,
  makeError,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './protocol'
import { dispatch } from './router'
import {
  generateToken,
  removeDotfile,
  setCurrentToken,
  writeDotfile,
} from './auth'
import { registerPing } from './methods/ping'
import { registerUpsertCollection } from './methods/upsert-collection'
import { registerUpsertFolder } from './methods/upsert-folder'
import { registerUpsertRequest } from './methods/upsert-request'
import { registerUpsertEnv } from './methods/upsert-env'
import { registerUpsertEnvVariable } from './methods/upsert-env-variable'
import { registerListWorkspaces } from './methods/list-workspaces'
import { registerListCollections } from './methods/list-collections'
import { registerListFolders } from './methods/list-folders'
import { registerListRequests } from './methods/list-requests'
import { registerListEnvs } from './methods/list-envs'
import { registerGetCollection } from './methods/get-collection'
import { registerGetFolder } from './methods/get-folder'
import { registerGetRequest } from './methods/get-request'
import { registerGetEnv } from './methods/get-env'
import { clearMethods } from './router'

let server: Server | null = null
let currentSocketPath: string | null = null

function resolveSocketPath(): string {
  const userData = process.env.VAXTLY_TEST_USERDATA ?? app.getPath('userData')
  if (process.platform === 'win32') {
    // Named pipes are bound to the user but identical names across installs
    // would still collide. Hash the userData path so dev / packaged / test
    // builds each get a unique pipe.
    const tag = createHash('sha1').update(userData).digest('hex').slice(0, 16)
    return `\\\\.\\pipe\\vaxtly-agent-${tag}`
  }
  return join(userData, 'agent.sock')
}

function handleConnection(conn: Socket): void {
  conn.setEncoding('utf8')
  const buf = new LineBuffer()

  const send = (msg: JsonRpcResponse): void => {
    if (!conn.writable) return
    conn.write(encodeFrame(msg))
  }

  conn.on('data', (chunk: string) => {
    const lines = buf.push(chunk)
    for (const line of lines) {
      if (line.trim().length === 0) continue
      processLine(line).then(send).catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        send(makeError(null, ERR.INTERNAL, message))
      })
    }
  })

  conn.on('error', () => {
    // ECONNRESET / EPIPE are normal when a client disconnects mid-write.
  })
}

async function processLine(line: string): Promise<JsonRpcResponse> {
  let req: JsonRpcRequest
  try {
    req = JSON.parse(line) as JsonRpcRequest
  } catch {
    return makeError(null, ERR.PARSE, 'Invalid JSON')
  }
  return dispatch(req)
}

export async function start(): Promise<void> {
  if (server) return // already running

  // Register all methods up-front so dispatch sees them on the first connection.
  // clearMethods() makes start() idempotent for tests that restart the server.
  clearMethods()
  registerPing()
  registerUpsertCollection()
  registerUpsertFolder()
  registerUpsertRequest()
  registerUpsertEnv()
  registerUpsertEnvVariable()
  registerListWorkspaces()
  registerListCollections()
  registerListFolders()
  registerListRequests()
  registerListEnvs()
  registerGetCollection()
  registerGetFolder()
  registerGetRequest()
  registerGetEnv()

  const socketPath = resolveSocketPath()

  // Clean up a stale socket file from a previous crashed run. (Named pipes
  // don't persist after the owning process exits.)
  if (process.platform !== 'win32' && existsSync(socketPath)) {
    try {
      unlinkSync(socketPath)
    } catch {
      // best-effort
    }
  }

  const token = generateToken()
  setCurrentToken(token)

  let version = 'dev'
  try {
    version = app.getVersion()
  } catch {
    /* test harness */
  }

  writeDotfile({
    socket_path: socketPath,
    token,
    pid: process.pid,
    app_version: version,
  })

  await new Promise<void>((resolve, reject) => {
    server = createServer(handleConnection)
    server.once('error', reject)
    server.listen(socketPath, () => {
      server!.off('error', reject)
      resolve()
    })
  })

  currentSocketPath = socketPath
}

export function stop(): void {
  if (server) {
    try {
      server.close()
    } catch {
      // best-effort
    }
    server = null
  }
  if (currentSocketPath && process.platform !== 'win32' && existsSync(currentSocketPath)) {
    try {
      unlinkSync(currentSocketPath)
    } catch {
      // best-effort
    }
  }
  currentSocketPath = null
  removeDotfile()
}

export function isRunning(): boolean {
  return server !== null
}
