/**
 * Idempotent request upsert keyed on (collection_id, external_key).
 *
 * Within the same collection the request may be moved between folders
 * (including to the collection root via empty/null `folder_external_key`).
 * Fields omitted from `params` are preserved.
 *
 * Headers, query params, body, and auth are passed through as the caller
 * supplied them; the repository encrypts sensitive auth fields transparently.
 */

import * as requestsRepo from '../../../database/repositories/requests'
import * as requestsActions from '../../../actions/requests'
import { registerMethod, HandlerError } from '../router'
import { ERR } from '../protocol'
import {
  optionalString,
  requireString,
  resolveCollectionId,
  resolveFolderId,
  resolveUpsertTarget,
  resolveWorkspaceId,
} from './_resolvers'
import type { UpsertResult } from './upsert-collection'
import type { Request as RequestModel } from '../../../../shared/types/models'

function jsonStringOrUndefined(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (value === null) return undefined
  if (typeof value === 'string') {
    // Treat string-form as already serialized JSON.
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    throw new HandlerError(ERR.VALIDATION, `${field} could not be serialized to JSON`)
  }
}

export function registerUpsertRequest(): void {
  registerMethod('upsert.request', (params): UpsertResult => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    const collectionId = resolveCollectionId(workspaceId, params.collection_external_key)
    const externalKey = requireString(params.external_key, 'external_key')
    const folderId = resolveFolderId(collectionId, params.folder_external_key)

    const method = optionalString(params.method, 'method')
    const url = optionalString(params.url, 'url')
    const bodyType = optionalString(params.body_type, 'body_type')
    const body = jsonStringOrUndefined(params.body, 'body')
    const headers = jsonStringOrUndefined(params.headers, 'headers')
    const queryParams = jsonStringOrUndefined(params.query_params, 'query_params')
    const auth = jsonStringOrUndefined(params.auth, 'auth')

    const existing = resolveUpsertTarget({
      id: params.id,
      externalKey,
      label: 'Request',
      findById: requestsRepo.findById,
      findByExternalKey: (k) => requestsRepo.findByExternalKey(collectionId, k),
      inScope: (r) => r.collection_id === collectionId,
    })
    if (existing) {
      const name = optionalString(params.name, 'name')
      const updates: Partial<Omit<RequestModel, 'id' | 'created_at'>> = {
        external_key: externalKey,
        ...(name !== undefined && { name }),
        ...(method !== undefined && { method }),
        ...(url !== undefined && { url }),
        ...(bodyType !== undefined && { body_type: bodyType }),
        ...(body !== undefined && { body }),
        ...(headers !== undefined && { headers }),
        ...(queryParams !== undefined && { query_params: queryParams }),
        ...(auth !== undefined && { auth }),
        ...(folderId !== undefined && { folder_id: folderId }),
      }
      const updated = requestsActions.updateRequest(existing.id, updates)!
      return {
        id: updated.id,
        external_key: externalKey,
        created: false,
        updated_at: updated.updated_at,
      }
    }

    const name = requireString(params.name, 'name')
    const created = requestsActions.createRequest({
      collection_id: collectionId,
      folder_id: folderId ?? undefined,
      name,
      method,
      url,
      body_type: bodyType,
      auth,
      external_key: externalKey,
    })

    // Headers/query_params/body aren't accepted by create(); apply them via update if set.
    let updatedAt = created.updated_at
    if (headers !== undefined || queryParams !== undefined || body !== undefined) {
      const followUp = requestsActions.updateRequest(created.id, {
        ...(headers !== undefined && { headers }),
        ...(queryParams !== undefined && { query_params: queryParams }),
        ...(body !== undefined && { body }),
      })
      if (followUp) updatedAt = followUp.updated_at
    }

    return {
      id: created.id,
      external_key: externalKey,
      created: true,
      updated_at: updatedAt,
    }
  })
}
