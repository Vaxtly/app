/**
 * Folder mutations. Thin wrapper over the repository so that the
 * agent-socket and IPC surfaces share a single mutation entry point.
 */

import * as foldersRepo from '../database/repositories/folders'
import type { Folder } from '../../shared/types/models'

export function createFolder(data: {
  collection_id: string
  name: string
  parent_id?: string
  external_key?: string | null
}): Folder {
  return foldersRepo.create(data)
}

export function updateFolder(
  id: string,
  data: Partial<Pick<Folder, 'name' | 'parent_id' | 'order' | 'environment_ids' | 'default_environment_id' | 'auth' | 'scripts' | 'external_key'>>,
): Folder | undefined {
  return foldersRepo.update(id, data)
}
