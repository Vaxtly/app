/**
 * Dispatch a parsed JSON-RPC request to a registered method handler.
 *
 * Every method receives its params with `auth` already verified and stripped.
 * Handlers may return a value, a Promise, or throw. Throws are mapped to
 * JSON-RPC error envelopes; `HandlerError` instances preserve their code,
 * everything else collapses to INTERNAL.
 */

import { ERR, makeError, makeSuccess, type JsonRpcRequest, type JsonRpcResponse } from './protocol'
import { verifyToken } from './auth'

export class HandlerError extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(message)
    this.name = 'HandlerError'
  }
}

export type MethodHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>

const methods = new Map<string, MethodHandler>()

export function registerMethod(name: string, handler: MethodHandler): void {
  methods.set(name, handler)
}

export function listMethods(): string[] {
  return [...methods.keys()]
}

export function clearMethods(): void {
  methods.clear()
}

export async function dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return makeError(req.id ?? null, ERR.INVALID_REQUEST, 'Malformed JSON-RPC 2.0 request')
  }

  if (!verifyToken(req.auth)) {
    return makeError(req.id, ERR.AUTH_FAILED, 'Authentication failed')
  }

  const handler = methods.get(req.method)
  if (!handler) {
    return makeError(req.id, ERR.METHOD_NOT_FOUND, `Method not found: ${req.method}`)
  }

  const params = (req.params ?? {}) as Record<string, unknown>
  try {
    const result = await handler(params)
    return makeSuccess(req.id, result)
  } catch (err) {
    if (err instanceof HandlerError) {
      return makeError(req.id, err.code, err.message, err.data)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    return makeError(req.id, ERR.INTERNAL, message)
  }
}
