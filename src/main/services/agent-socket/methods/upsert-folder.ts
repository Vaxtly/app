/**
 * Idempotent folder upsert keyed on (collection_id, external_key).
 *
 * On update, the folder may be re-parented (or moved to the collection root
 * via an empty/null `parent_folder_external_key`). Fields omitted from
 * `params` are preserved.
 */

import * as foldersRepo from '../../../database/repositories/folders'
import * as foldersActions from '../../../actions/folders'
import { registerMethod } from '../router'
import {
  optionalString,
  requireString,
  resolveCollectionId,
  resolveParentFolderId,
  resolveUpsertTarget,
  resolveWorkspaceId,
} from './_resolvers'
import type { UpsertResult } from './upsert-collection'

export function registerUpsertFolder(): void {
  registerMethod('upsert.folder', (params): UpsertResult => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const externalKey = requireString(params.external_key, 'external_key')
    const parentFolderId = resolveParentFolderId(collectionId, params.parent_folder_external_key)

    const existing = resolveUpsertTarget({
      id: params.id,
      externalKey,
      label: 'Folder',
      findById: foldersRepo.findById,
      findByExternalKey: (k) => foldersRepo.findByExternalKey(collectionId, k),
      inScope: (f) => f.collection_id === collectionId,
    })
    if (existing) {
      const name = optionalString(params.name, 'name')
      const updated = foldersActions.updateFolder(existing.id, {
        external_key: externalKey,
        ...(name !== undefined && { name }),
        ...(parentFolderId !== undefined && { parent_id: parentFolderId }),
      })!
      return {
        id: updated.id,
        external_key: externalKey,
        created: false,
        updated_at: updated.updated_at,
      }
    }

    const name = requireString(params.name, 'name')
    const created = foldersActions.createFolder({
      collection_id: collectionId,
      name,
      parent_id: parentFolderId ?? undefined,
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
