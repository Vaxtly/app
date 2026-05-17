/**
 * Upsert a SINGLE variable inside an environment without touching the others.
 *
 * Closes the gap created by redaction: read returns variable values as
 * "<redacted>", so an agent that wants to add one variable to an existing env
 * cannot safely re-pass the full variables array (it would wipe the values it
 * cannot see). This method is the safe alternative — pass only the key/value
 * you want to set, and the existing array is preserved.
 *
 * Idempotent on (env_external_key, key): if the variable key already exists
 * in the env, its value and enabled flag are updated in place; otherwise
 * the variable is appended to the array.
 *
 * The values from `findByExternalKey` are already decrypted (via the repo's
 * `findById` path), so we read, mutate, and pass the full plaintext array
 * back through the repo's update — which re-encrypts every value uniformly.
 */

import * as environmentsRepo from '../../../database/repositories/environments'
import * as environmentsActions from '../../../actions/environments'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import { requireString, resolveWorkspaceId } from './_resolvers'
import type { EnvironmentVariable } from '../../../../shared/types/models'

interface Result {
  id: string
  env_external_key: string
  key: string
  created: boolean
  updated_at: string
}

export function registerUpsertEnvVariable(): void {
  registerMethod('upsert.env_variable', (params): Result => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const envExternalKey = requireString(params.env_external_key, 'env_external_key')
    const key = requireString(params.key, 'key')

    if (typeof params.value !== 'string') {
      throw new HandlerError(ERR.VALIDATION, 'value is required (string; empty string allowed)')
    }
    const value = params.value
    const enabled = params.enabled === undefined ? true : Boolean(params.enabled)

    const env = environmentsRepo.findByExternalKey(workspaceId, envExternalKey)
    if (!env) {
      throw new HandlerError(ERR.NOT_FOUND, `Environment with external_key "${envExternalKey}" not found`)
    }

    let existing: EnvironmentVariable[] = []
    try {
      existing = env.variables ? (JSON.parse(env.variables) as EnvironmentVariable[]) : []
    } catch {
      // Corrupted JSON in the column shouldn't happen, but treat as empty rather than crash.
      existing = []
    }

    const idx = existing.findIndex((v) => v.key === key)
    const created = idx === -1
    if (idx === -1) {
      existing.push({ key, value, enabled })
    } else {
      existing[idx] = { key, value, enabled }
    }

    const updated = environmentsActions.updateEnvironment(env.id, {
      variables: JSON.stringify(existing),
    })
    if (!updated) {
      throw new HandlerError(ERR.INTERNAL, 'Failed to update environment')
    }

    return {
      id: updated.id,
      env_external_key: envExternalKey,
      key,
      created,
      updated_at: updated.updated_at,
    }
  })
}
