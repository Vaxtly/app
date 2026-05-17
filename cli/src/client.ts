/**
 * JSON-RPC 2.0 client over a Unix domain socket or Windows named pipe.
 * Frames are newline-delimited. Single in-flight request per connection
 * (the CLI does one call per invocation; no need for ID multiplexing).
 */

import { connect, type Socket } from 'node:net'
import { EXIT } from './exit'
import type { CliConfig } from './config'

interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id: number | string | null
  result: unknown
}

interface JsonRpcError {
  jsonrpc: '2.0'
  id: number | string | null
  error: { code: number; message: string; data?: unknown }
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

export class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message)
  }
}

export async function rpc(
  config: CliConfig,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const conn: Socket = await new Promise((resolve, reject) => {
    const c = connect(config.socket_path)
    c.once('connect', () => resolve(c))
    c.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
        process.stderr.write('Vaxtly is not running. Start the app and try again.\n')
        process.exit(EXIT.NOT_RUNNING)
      }
      reject(err)
    })
  })

  try {
    conn.setEncoding('utf8')
    const frame = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      auth: config.token,
      params,
    }) + '\n'

    const reply: JsonRpcResponse = await new Promise((resolve, reject) => {
      let buf = ''
      conn.on('data', (chunk: string) => {
        buf += chunk
        const nl = buf.indexOf('\n')
        if (nl === -1) return
        const line = buf.slice(0, nl)
        try {
          resolve(JSON.parse(line) as JsonRpcResponse)
        } catch (err) {
          reject(err)
        }
      })
      conn.on('error', reject)
      conn.write(frame)
    })

    if ('error' in reply) {
      throw new RpcError(reply.error.code, reply.error.message)
    }
    return reply.result
  } finally {
    // destroy (not end) so the handle is released immediately and the CLI
    // process can exit — graceful close keeps the socket half-open waiting
    // on the server's FIN.
    conn.destroy()
  }
}
