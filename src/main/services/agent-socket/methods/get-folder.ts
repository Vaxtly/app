/**
 * Fetch a folder by external_key within a collection, auth redacted.
 */

import * as foldersRepo from '../../../database/repositories/folders'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import { requireString, resolveCollectionId, resolveWorkspaceId } from './_resolvers'
import { redactAuthJson } from './_redact'

export function registerGetFolder(): void {
  registerMethod('get.folder', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const externalKey = requireString(params.external_key, 'external_key')
    const folder = foldersRepo.findByExternalKey(collectionId, externalKey)
    if (!folder) {
      throw new HandlerError(ERR.NOT_FOUND, `Folder with external_key "${externalKey}" not found in collection`)
    }
    return { ...folder, auth: redactAuthJson(folder.auth) }
  })
}
