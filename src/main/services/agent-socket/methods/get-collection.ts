/**
 * Fetch a collection by external_key with its `auth` field redacted.
 */

import * as collectionsRepo from '../../../database/repositories/collections'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import { requireString, resolveWorkspaceId } from './_resolvers'
import { redactAuthJson } from './_redact'

export function registerGetCollection(): void {
  registerMethod('get.collection', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const externalKey = requireString(params.external_key, 'external_key')
    const col = collectionsRepo.findByExternalKey(workspaceId, externalKey)
    if (!col) {
      throw new HandlerError(ERR.NOT_FOUND, `Collection with external_key "${externalKey}" not found`)
    }
    return { ...col, auth: redactAuthJson(col.auth) }
  })
}
