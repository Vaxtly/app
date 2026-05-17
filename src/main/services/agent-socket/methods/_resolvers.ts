/**
 * Translate caller-friendly external keys to internal UUIDs, with clear
 * NOT_FOUND errors when a referenced parent doesn't exist. Keeps the upsert
 * methods focused on the create/update branching.
 */

import * as workspacesRepo from '../../../database/repositories/workspaces'
import * as collectionsRepo from '../../../database/repositories/collections'
import * as foldersRepo from '../../../database/repositories/folders'
import * as environmentsRepo from '../../../database/repositories/environments'
import { HandlerError } from '../router'
import { ERR } from '../protocol'

/** Returns the caller's chosen workspace, or the first workspace if none specified. */
export function resolveWorkspaceId(provided: unknown): string {
  if (typeof provided === 'string' && provided.length > 0) {
    const ws = workspacesRepo.findById(provided)
    if (!ws) throw new HandlerError(ERR.NOT_FOUND, `Workspace ${provided} not found`)
    return ws.id
  }
  const all = workspacesRepo.findAll()
  if (all.length === 0) {
    throw new HandlerError(ERR.NOT_FOUND, 'No workspace exists. Launch Vaxtly once to create the default workspace.')
  }
  return all[0].id
}

export function resolveCollectionId(workspaceId: string, externalKey: unknown): string {
  if (typeof externalKey !== 'string' || externalKey.length === 0) {
    throw new HandlerError(ERR.VALIDATION, 'collection_external_key is required')
  }
  const col = collectionsRepo.findByExternalKey(workspaceId, externalKey)
  if (!col) {
    throw new HandlerError(ERR.NOT_FOUND, `Collection with external_key "${externalKey}" not found in workspace`)
  }
  return col.id
}

/**
 * Resolve a folder reference within a collection. An empty string or explicit
 * null means "no folder" (collection root). Undefined means "not provided"
 * and returns undefined so callers can distinguish "preserve" from "clear".
 */
export function resolveFolderId(
  collectionId: string,
  externalKey: unknown,
): string | null | undefined {
  if (externalKey === undefined) return undefined
  if (externalKey === null || externalKey === '') return null
  if (typeof externalKey !== 'string') {
    throw new HandlerError(ERR.VALIDATION, 'folder_external_key must be a string, null, or empty')
  }
  const folder = foldersRepo.findByExternalKey(collectionId, externalKey)
  if (!folder) {
    throw new HandlerError(ERR.NOT_FOUND, `Folder with external_key "${externalKey}" not found in collection`)
  }
  return folder.id
}

export function resolveParentFolderId(
  collectionId: string,
  externalKey: unknown,
): string | null | undefined {
  // Same semantics as resolveFolderId but with a label clearer for nested folders
  return resolveFolderId(collectionId, externalKey)
}

export function resolveParentEnvId(
  workspaceId: string,
  externalKey: unknown,
): string | null | undefined {
  if (externalKey === undefined) return undefined
  if (externalKey === null || externalKey === '') return null
  if (typeof externalKey !== 'string') {
    throw new HandlerError(ERR.VALIDATION, 'parent_external_key must be a string, null, or empty')
  }
  const env = environmentsRepo.findByExternalKey(workspaceId, externalKey)
  if (!env) {
    throw new HandlerError(ERR.NOT_FOUND, `Parent environment with external_key "${externalKey}" not found`)
  }
  return env.id
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HandlerError(ERR.VALIDATION, `${field} is required`)
  }
  return value
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new HandlerError(ERR.VALIDATION, `${field} must be a string`)
  }
  return value
}
