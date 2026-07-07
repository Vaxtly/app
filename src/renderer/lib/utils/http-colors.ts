const METHOD_KEYS: Record<string, string> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  QUERY: 'query',
  HEAD: 'head',
  OPTIONS: 'options',
  LIST: 'list',
  WEBSOCKET: 'ws',
}

/** CSS variable value for an HTTP method color (theme-aware) */
export function getMethodColor(method: string): string {
  const key = METHOD_KEYS[method.toUpperCase()]
  return key ? `var(--color-method-${key})` : 'var(--color-surface-400)'
}

/** CSS variable value for an HTTP status code color (theme-aware) */
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--color-status-success)'
  if (status >= 300 && status < 400) return 'var(--color-status-redirect)'
  if (status >= 400 && status < 500) return 'var(--color-status-client-error)'
  if (status >= 500) return 'var(--color-status-server-error)'
  return 'var(--color-surface-400)'
}
