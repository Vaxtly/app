/**
 * Request mutations. Centralizes the "mutate request → mark its collection
 * dirty" pairing so the agent-socket and IPC surfaces stay aligned. Any new
 * sync/audit side effect on request changes belongs here.
 */

import * as requestsRepo from '../database/repositories/requests'
import * as collectionsRepo from '../database/repositories/collections'
import type { Request } from '../../shared/types/models'

export function createRequest(data: {
  collection_id: string
  name: string
  folder_id?: string
  method?: string
  url?: string
  body_type?: string
  auth?: string
  external_key?: string | null
}): Request {
  const result = requestsRepo.create(data)
  collectionsRepo.markDirty(data.collection_id)
  return result
}

export function updateRequest(
  id: string,
  data: Partial<Omit<Request, 'id' | 'created_at'>>,
): Request | null {
  const existing = requestsRepo.findById(id)
  if (!existing) return null

  // Skip update + markDirty when nothing actually changed
  const changed = Object.keys(data).some(
    (key) => JSON.stringify((existing as Record<string, unknown>)[key]) !== JSON.stringify((data as Record<string, unknown>)[key]),
  )
  if (!changed) return existing

  const result = requestsRepo.update(id, data)
  if (result) collectionsRepo.markDirty(result.collection_id)
  return result ?? null
}

export function deleteRequest(id: string): boolean {
  const existing = requestsRepo.findById(id)
  const deleted = requestsRepo.remove(id)
  if (deleted && existing) collectionsRepo.markDirty(existing.collection_id)
  return deleted
}

export function moveRequest(
  id: string,
  targetFolderId: string | null,
  targetCollectionId?: string,
): Request | undefined {
  const before = requestsRepo.findById(id)
  const result = requestsRepo.move(id, targetFolderId, targetCollectionId)
  if (result) {
    collectionsRepo.markDirty(result.collection_id)
    if (before && before.collection_id !== result.collection_id) {
      collectionsRepo.markDirty(before.collection_id)
    }
  }
  return result
}

export function reorderRequests(ids: string[]): void {
  requestsRepo.reorder(ids)
  if (ids.length > 0) {
    const req = requestsRepo.findById(ids[0])
    if (req) collectionsRepo.markDirty(req.collection_id)
  }
}
