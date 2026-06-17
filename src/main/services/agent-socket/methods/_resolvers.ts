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

/**
 * Resolve the target row for an idempotent upsert.
 *
 * Normal path (no `id`): look the row up by its external_key — the basis for
 * idempotency. Returns undefined when nothing matches, signalling "create".
 *
 * Adoption path (`id` provided): the caller is claiming an existing row —
 * typically one created in the UI with no external_key — and assigning it the
 * given external_key. We look it up by UUID, confirm it lives in the expected
 * scope, and refuse if that external_key is already taken by a different row.
 * The caller writes `external_key` into its update payload to persist the link.
 */
export function resolveUpsertTarget<T extends { id: string }>(opts: {
  id: unknown
  externalKey: string
  label: string
  findById: (id: string) => T | undefined
  findByExternalKey: (externalKey: string) => T | undefined
  inScope: (row: T) => boolean
}): T | undefined {
  if (opts.id === undefined) {
    return opts.findByExternalKey(opts.externalKey)
  }
  if (typeof opts.id !== 'string' || opts.id.length === 0) {
    throw new HandlerError(ERR.VALIDATION, 'id must be a non-empty string when provided')
  }
  const row = opts.findById(opts.id)
  if (!row || !opts.inScope(row)) {
    throw new HandlerError(ERR.NOT_FOUND, `${opts.label} with id "${opts.id}" not found in this scope`)
  }
  const clash = opts.findByExternalKey(opts.externalKey)
  if (clash && clash.id !== row.id) {
    throw new HandlerError(
      ERR.CONFLICT,
      `external_key "${opts.externalKey}" is already used by another ${opts.label.toLowerCase()} in this scope`,
    )
  }
  return row
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
