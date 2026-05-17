/**
 * Collection mutations. Thin wrapper over the repository so that the
 * agent-socket and IPC surfaces share a single mutation entry point.
 */

import * as collectionsRepo from '../database/repositories/collections'
import type { Collection } from '../../shared/types/models'

export function createCollection(data: {
  name: string
  workspace_id?: string
  description?: string
  external_key?: string | null
}): Collection {
  return collectionsRepo.create(data)
}

export function updateCollection(
  id: string,
  data: Partial<Omit<Collection, 'id' | 'created_at'>>,
): Collection | undefined {
  return collectionsRepo.update(id, data)
}
