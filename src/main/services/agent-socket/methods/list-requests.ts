/**
 * List requests inside a collection, optionally narrowed to a folder.
 * Returns the request method + url so the agent can match by purpose
 * without a follow-up get for each row.
 */

import * as requestsRepo from '../../../database/repositories/requests'
import * as foldersRepo from '../../../database/repositories/folders'
import { registerMethod } from '../router'
import { resolveCollectionId, resolveFolderId, resolveWorkspaceId } from './_resolvers'

export function registerListRequests(): void {
  registerMethod('list.requests', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const folderFilter = resolveFolderId(collectionId, params.folder_external_key)

    const rows =
      folderFilter === undefined
        ? requestsRepo.findByCollection(collectionId)
        : requestsRepo.findByFolder(folderFilter, collectionId)

    // Map folder_id → folder external_key for compact output.
    const folders = foldersRepo.findByCollection(collectionId)
    const folderKeyById = new Map(folders.map((f) => [f.id, f.external_key]))

    return rows.map((r) => ({
      id: r.id,
      external_key: r.external_key,
      name: r.name,
      method: r.method,
      url: r.url,
      folder_external_key: r.folder_id ? folderKeyById.get(r.folder_id) ?? null : null,
    }))
  })
}
