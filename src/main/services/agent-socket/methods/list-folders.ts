/**
 * List folders inside a collection. Returns each folder's parent_external_key
 * so the agent can reconstruct the tree without a second round-trip per node.
 */

import * as foldersRepo from '../../../database/repositories/folders'
import { registerMethod } from '../router'
import { resolveCollectionId, resolveWorkspaceId } from './_resolvers'

export function registerListFolders(): void {
  registerMethod('list.folders', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const folders = foldersRepo.findByCollection(collectionId)
    const byId = new Map(folders.map((f) => [f.id, f.external_key]))
    return folders.map((f) => ({
      id: f.id,
      external_key: f.external_key,
      name: f.name,
      parent_external_key: f.parent_id ? byId.get(f.parent_id) ?? null : null,
    }))
  })
}
