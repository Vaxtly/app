/**
 * Fetch an environment by external_key, with every variable's `value` redacted.
 * Keys stay visible so the agent can use them in variable substitution.
 */

import * as environmentsRepo from '../../../database/repositories/environments'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import { requireString, resolveWorkspaceId } from './_resolvers'
import { redactVariablesJson } from './_redact'

export function registerGetEnv(): void {
  registerMethod('get.env', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const externalKey = requireString(params.external_key, 'external_key')
    const env = environmentsRepo.findByExternalKey(workspaceId, externalKey)
    if (!env) {
      throw new HandlerError(ERR.NOT_FOUND, `Environment with external_key "${externalKey}" not found`)
    }
    return { ...env, variables: redactVariablesJson(env.variables) }
  })
}
