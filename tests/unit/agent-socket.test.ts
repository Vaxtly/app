/**
 * Integration tests for the local agent socket. Talks to a real Unix domain
 * socket (POSIX) or named pipe (Windows) via Node's net module.
 *
 * The Electron `app` API isn't available in Vitest, so we stub `app.getPath`
 * and `app.getVersion` against a temp directory before importing the server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connect, type Socket } from 'node:net'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LineBuffer } from '../../src/main/services/agent-socket/protocol'

let userDataDir: string
let cliConfigDir: string

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'userData') return userDataDir
      throw new Error(`mock app.getPath(${key}) unsupported`)
    },
    getVersion: () => '0.0.0-test',
  },
}))

async function importServer() {
  // Reset module state between tests so each gets a fresh server singleton.
  vi.resetModules()
  return import('../../src/main/services/agent-socket')
}

interface RpcExchange {
  conn: Socket
  send: (frame: object) => void
  next: () => Promise<unknown>
  close: () => void
}

function openExchange(socketPath: string): Promise<RpcExchange> {
  return new Promise((resolve, reject) => {
    const conn = connect(socketPath)
    const buf = new LineBuffer()
    const queue: unknown[] = []
    const waiters: ((v: unknown) => void)[] = []

    conn.setEncoding('utf8')
    conn.on('connect', () => {
      resolve({
        conn,
        send: (frame) => conn.write(JSON.stringify(frame) + '\n'),
        next: () =>
          new Promise<unknown>((res) => {
            if (queue.length > 0) res(queue.shift())
            else waiters.push(res)
          }),
        close: () => conn.end(),
      })
    })
    conn.on('error', reject)
    conn.on('data', (chunk: string) => {
      for (const line of buf.push(chunk)) {
        if (!line.trim()) continue
        const msg = JSON.parse(line)
        const waiter = waiters.shift()
        if (waiter) waiter(msg)
        else queue.push(msg)
      }
    })
  })
}

beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'vaxtly-userdata-'))
  cliConfigDir = mkdtempSync(join(tmpdir(), 'vaxtly-cli-'))
  process.env.VAXTLY_TEST_CLI_CONFIG_DIR = cliConfigDir
  process.env.VAXTLY_TEST_USERDATA = userDataDir
})

afterEach(() => {
  delete process.env.VAXTLY_TEST_CLI_CONFIG_DIR
  delete process.env.VAXTLY_TEST_USERDATA
  rmSync(userDataDir, { recursive: true, force: true })
  rmSync(cliConfigDir, { recursive: true, force: true })
})

describe('agent-socket server', () => {
  it('starts, writes cli.json (0600), and answers ping with the right token', async () => {
    const server = await importServer()
    await server.start()

    const dotfilePath = join(cliConfigDir, 'cli.json')
    expect(existsSync(dotfilePath)).toBe(true)
    const dotfile = JSON.parse(readFileSync(dotfilePath, 'utf8')) as {
      socket_path: string
      token: string
      pid: number
      app_version: string
    }
    expect(dotfile.token).toMatch(/^[a-f0-9]{64}$/)
    expect(dotfile.app_version).toBe('0.0.0-test')

    const ex = await openExchange(dotfile.socket_path)
    ex.send({ jsonrpc: '2.0', id: 1, method: 'ping', auth: dotfile.token })
    const reply = (await ex.next()) as { id: number; result: { pong: boolean; app_version: string } }
    expect(reply.id).toBe(1)
    expect(reply.result.pong).toBe(true)
    expect(reply.result.app_version).toBe('0.0.0-test')

    ex.close()
    server.stop()
    expect(existsSync(dotfilePath)).toBe(false)
  })

  it('rejects requests with a wrong token via JSON-RPC error -32001', async () => {
    const server = await importServer()
    await server.start()
    const dotfile = JSON.parse(readFileSync(join(cliConfigDir, 'cli.json'), 'utf8')) as {
      socket_path: string
      token: string
    }

    const ex = await openExchange(dotfile.socket_path)
    ex.send({ jsonrpc: '2.0', id: 1, method: 'ping', auth: 'nope' })
    const reply = (await ex.next()) as { error?: { code: number } }
    expect(reply.error?.code).toBe(-32001)

    ex.close()
    server.stop()
  })

  it('rejects unknown methods via JSON-RPC error -32601', async () => {
    const server = await importServer()
    await server.start()
    const dotfile = JSON.parse(readFileSync(join(cliConfigDir, 'cli.json'), 'utf8')) as {
      socket_path: string
      token: string
    }

    const ex = await openExchange(dotfile.socket_path)
    ex.send({ jsonrpc: '2.0', id: 2, method: 'does.not.exist', auth: dotfile.token })
    const reply = (await ex.next()) as { error?: { code: number } }
    expect(reply.error?.code).toBe(-32601)

    ex.close()
    server.stop()
  })

  it('parses garbage as -32700', async () => {
    const server = await importServer()
    await server.start()
    const dotfile = JSON.parse(readFileSync(join(cliConfigDir, 'cli.json'), 'utf8')) as {
      socket_path: string
    }

    const ex = await openExchange(dotfile.socket_path)
    ex.conn.write('this is not json\n')
    const reply = (await ex.next()) as { error?: { code: number } }
    expect(reply.error?.code).toBe(-32700)

    ex.close()
    server.stop()
  })

  it('rotates the token across restarts', async () => {
    const server = await importServer()
    await server.start()
    const t1 = JSON.parse(readFileSync(join(cliConfigDir, 'cli.json'), 'utf8')).token
    server.stop()

    await server.start()
    const t2 = JSON.parse(readFileSync(join(cliConfigDir, 'cli.json'), 'utf8')).token
    server.stop()

    expect(t1).not.toBe(t2)
  })
})
