/**
 * Idempotent environment upsert keyed on (workspace_id, external_key).
 *
 * Variables are sent as a plain array of EnvironmentVariable objects; the
 * repository handles AES-GCM encryption of each `value` field transparently.
 *
 * Parent environments must already exist (the upsert method does not
 * auto-create the parent). The repository enforces the 2-level depth cap.
 */

import * as environmentsRepo from '../../../database/repositories/environments'
import * as environmentsActions from '../../../actions/environments'
import { registerMethod, HandlerError } from '../router'
import { notifyAgentDataChanged } from '../notifier'
import { ERR } from '../protocol'
import {
  optionalString,
  requireString,
  resolveParentEnvId,
  resolveUpsertTarget,
  resolveWorkspaceId,
} from './_resolvers'
import type { UpsertResult } from './upsert-collection'

function variablesToJson(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (value === null) return '[]'
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) {
    throw new HandlerError(ERR.VALIDATION, 'variables must be an array of {key, value, enabled?} entries')
  }
  return JSON.stringify(value)
}

export function registerUpsertEnv(): void {
  registerMethod('upsert.env', (params): UpsertResult => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const externalKey = requireString(params.external_key, 'external_key')
    const parentId = resolveParentEnvId(workspaceId, params.parent_external_key)
    const variables = variablesToJson(params.variables)

    const existing = resolveUpsertTarget({
      id: params.id,
      externalKey,
      label: 'Environment',
      findById: environmentsRepo.findById,
      findByExternalKey: (k) => environmentsRepo.findByExternalKey(workspaceId, k),
      inScope: (e) => e.workspace_id === workspaceId,
    })
    let result: UpsertResult
    if (existing) {
      const name = optionalString(params.name, 'name')
      const updated = environmentsActions.updateEnvironment(existing.id, {
        external_key: externalKey,
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parent_id: parentId }),
        ...(variables !== undefined && { variables }),
      })!
      result = {
        id: updated.id,
        external_key: externalKey,
        created: false,
        updated_at: updated.updated_at,
      }
    } else {
      const name = requireString(params.name, 'name')
      const created = environmentsActions.createEnvironment({
        name,
        workspace_id: workspaceId,
        parent_id: parentId ?? null,
        variables,
        external_key: externalKey,
      })
      result = {
        id: created.id,
        external_key: externalKey,
        created: true,
        updated_at: created.updated_at,
      }
    }

    notifyAgentDataChanged({ workspaceId, kind: 'env' })
    return result
  })
}
