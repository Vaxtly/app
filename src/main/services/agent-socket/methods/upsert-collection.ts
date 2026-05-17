/**
 * Idempotent collection upsert keyed on (workspace_id, external_key).
 *
 * Re-running with the same external_key updates the existing collection
 * instead of duplicating. Fields omitted from `params` are preserved.
 */

import * as collectionsRepo from '../../../database/repositories/collections'
import * as collectionsActions from '../../../actions/collections'
import { registerMethod } from '../router'
import { optionalString, requireString, resolveWorkspaceId } from './_resolvers'

export interface UpsertResult {
  id: string
  external_key: string
  created: boolean
  updated_at: string
}

export function registerUpsertCollection(): void {
  registerMethod('upsert.collection', (params): UpsertResult => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const externalKey = requireString(params.external_key, 'external_key')
    const description = optionalString(params.description, 'description')

    const existing = collectionsRepo.findByExternalKey(workspaceId, externalKey)
    if (existing) {
      const name = optionalString(params.name, 'name')
      const updated = collectionsActions.updateCollection(existing.id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      })!
      return {
        id: updated.id,
        external_key: externalKey,
        created: false,
        updated_at: updated.updated_at,
      }
    }

    const name = requireString(params.name, 'name')
    const created = collectionsActions.createCollection({
      name,
      workspace_id: workspaceId,
      description,
      external_key: externalKey,
    })
    return {
      id: created.id,
      external_key: externalKey,
      created: true,
      updated_at: created.updated_at,
    }
  })
}
