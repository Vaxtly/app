/**
 * Newline-delimited JSON-RPC 2.0 framing for a stream socket.
 *
 * One JSON object per line. JSON.stringify guarantees no raw newlines inside
 * a frame, so splitting on '\n' is sufficient. The buffer carries any partial
 * trailing fragment between data chunks.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  /** Per-session bearer token. Lives in the envelope, not in params, so that
   *  method-specific param names (like an `auth` config on a request) can't
   *  shadow the transport credential. */
  auth?: string
  params?: Record<string, unknown>
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id: number | string | null
  result: unknown
}

export interface JsonRpcError {
  jsonrpc: '2.0'
  id: number | string | null
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

export const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  AUTH_FAILED: -32001,
  NOT_FOUND: -32002,
  VALIDATION: -32003,
  CONFLICT: -32004,
} as const

export function encodeFrame(message: JsonRpcResponse): string {
  return JSON.stringify(message) + '\n'
}

export function makeError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  const err: JsonRpcError['error'] = { code, message }
  if (data !== undefined) err.data = data
  return { jsonrpc: '2.0', id, error: err }
}

export function makeSuccess(id: number | string | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result }
}

/**
 * Stateful line splitter. Feed chunks of bytes; yields zero or more complete
 * lines (without the trailing '\n'). Holds any incomplete trailing fragment.
 */
export class LineBuffer {
  private buf = ''

  push(chunk: string): string[] {
    this.buf += chunk
    const lines: string[] = []
    let idx: number
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      lines.push(this.buf.slice(0, idx))
      this.buf = this.buf.slice(idx + 1)
    }
    return lines
  }
}
