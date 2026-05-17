/**
 * List environments in a workspace, with parent linkage so the agent can see
 * the 2-level chain at a glance. Variables are NOT returned — use get.env for
 * variable keys (values are always redacted; keys are visible).
 */

import * as environmentsRepo from '../../../database/repositories/environments'
import { registerMethod } from '../router'
import { resolveWorkspaceId } from './_resolvers'

export function registerListEnvs(): void {
  registerMethod('list.envs', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const envs = environmentsRepo.findByWorkspace(workspaceId)
    const keyById = new Map(envs.map((e) => [e.id, e.external_key]))
    return envs.map((e) => ({
      id: e.id,
      external_key: e.external_key,
      name: e.name,
      is_active: e.is_active === 1,
      vault_synced: e.vault_synced === 1,
      parent_external_key: e.parent_id ? keyById.get(e.parent_id) ?? null : null,
    }))
  })
}
