/**
 * Hardcoded, unconditional redaction of every field the repos treat as
 * sensitive. The agent socket NEVER returns plaintext secrets on the wire,
 * regardless of caller. If a user genuinely needs the agent to know a value,
 * they paste it manually — that is a deliberate, auditable choice, whereas
 * giving any tool a flag to disable masking is a footgun in waiting (prompt
 * injection from another tool could try to flip it).
 *
 * Empty / null values are preserved so the agent can still see which fields
 * are *configured* versus unset. Keys on environment variables are visible
 * (the agent needs to know what names exist for substitution); only values
 * are hidden.
 */

import type { AuthConfig, EnvironmentVariable } from '../../../../shared/types/models'

export const REDACTED = '<redacted>'

const AUTH_SENSITIVE_FIELDS: (keyof AuthConfig)[] = [
  'bearer_token',
  'basic_username',
  'basic_password',
  'api_key_value',
  'oauth2_client_secret',
  'oauth2_password',
  'oauth2_access_token',
  'oauth2_refresh_token',
]

export function redactAuthJson(authJson: string | null): string | null {
  if (!authJson) return authJson
  let auth: AuthConfig
  try {
    auth = JSON.parse(authJson) as AuthConfig
  } catch {
    return authJson
  }
  for (const field of AUTH_SENSITIVE_FIELDS) {
    const val = auth[field]
    if (typeof val === 'string' && val.length > 0) {
      ;(auth as Record<string, string>)[field] = REDACTED
    }
  }
  return JSON.stringify(auth)
}

export function redactVariablesJson(varsJson: string): string {
  if (!varsJson || varsJson === '[]') return varsJson
  let vars: EnvironmentVariable[]
  try {
    vars = JSON.parse(varsJson) as EnvironmentVariable[]
  } catch {
    return varsJson
  }
  return JSON.stringify(
    vars.map((v) => (v.value ? { ...v, value: REDACTED } : v)),
  )
}
