/** Application-wide constants */

export const HTTP_METHODS = [
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'HEAD', 'OPTIONS', 'LIST'
] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

export const BODY_TYPES = [
  'none', 'json', 'xml', 'form-data', 'urlencoded', 'raw', 'graphql'
] as const

export type BodyType = (typeof BODY_TYPES)[number]

export const AUTH_TYPES = [
  'inherit', 'none', 'bearer', 'basic', 'api-key', 'oauth2'
] as const

export type AuthType = (typeof AUTH_TYPES)[number]

/** Headers that may contain sensitive data */
export const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'proxy-authorization',
  'cookie',
  'set-cookie',
] as const

/** Query param keys that may contain sensitive data */
export const SENSITIVE_PARAM_KEYS = [
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'token',
  'secret',
  'password',
  'passwd',
  'auth',
] as const

/** Check if a request method represents a WebSocket connection */
export function isWebSocketRequest(method: string): boolean {
  return method === 'WEBSOCKET'
}

/** Max messages stored per WebSocket connection */
export const WS_MESSAGE_LOG_MAX = 500

/** Default settings */
export const DEFAULTS = {
  REQUEST_TIMEOUT_MS: 30000,
  FOLLOW_REDIRECTS: true,
  VERIFY_SSL: true,
  MAX_SCRIPT_CHAIN_DEPTH: 3,
  MAX_VARIABLE_NESTING: 10,
  SESSION_LOG_MAX_ENTRIES: 100,
  SESSION_LOG_BODY_MAX_SIZE: 50 * 1024,
} as const
