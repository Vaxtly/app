/**
 * Fetch a request by external_key within a collection, auth redacted.
 * Headers / query params / body come back unmodified — those are not
 * encrypted at the repo and an agent likely needs them to edit the request.
 */

import * as requestsRepo from '../../../database/repositories/requests'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import { requireString, resolveCollectionId, resolveWorkspaceId } from './_resolvers'
import { redactAuthJson } from './_redact'

export function registerGetRequest(): void {
  registerMethod('get.request', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const externalKey = requireString(params.external_key, 'external_key')
    const req = requestsRepo.findByExternalKey(collectionId, externalKey)
    if (!req) {
      throw new HandlerError(ERR.NOT_FOUND, `Request with external_key "${externalKey}" not found in collection`)
    }
    return { ...req, auth: redactAuthJson(req.auth) }
  })
}
