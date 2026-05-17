/**
 * Tests for the external_key column added in migration 009:
 * - Round-trips on create/update for collections, folders, requests, environments.
 * - findByExternalKey resolves within the correct parent scope.
 * - Partial unique index rejects same-scope duplicates but allows multiple NULLs.
 * - Request external_key uniqueness is scoped to collection (folder moves OK).
 * - Environment external_key uniqueness is scoped to workspace (parent moves OK).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openTestDatabase, closeDatabase, getDatabase } from '../../src/main/database/connection'
import { initEncryptionForTesting } from '../../src/main/services/encryption'
import * as workspacesRepo from '../../src/main/database/repositories/workspaces'
import * as collectionsRepo from '../../src/main/database/repositories/collections'
import * as foldersRepo from '../../src/main/database/repositories/folders'
import * as requestsRepo from '../../src/main/database/repositories/requests'
import * as environmentsRepo from '../../src/main/database/repositories/environments'

beforeEach(() => {
  openTestDatabase()
  initEncryptionForTesting()
})

afterEach(() => {
  closeDatabase()
})

describe('collections.external_key', () => {
  it('persists external_key on create and findByExternalKey resolves it', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'Acme', workspace_id: ws.id, external_key: 'acme' })
    expect(col.external_key).toBe('acme')
    const found = collectionsRepo.findByExternalKey(ws.id, 'acme')
    expect(found?.id).toBe(col.id)
  })

  it('returns undefined when external_key not found', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expect(collectionsRepo.findByExternalKey(ws.id, 'missing')).toBeUndefined()
  })

  it('allows multiple collections with NULL external_key (partial index)', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    collectionsRepo.create({ name: 'A', workspace_id: ws.id })
    collectionsRepo.create({ name: 'B', workspace_id: ws.id })
    // No throw — partial unique index ignores NULLs.
  })

  it('rejects duplicate external_key within the same workspace', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    collectionsRepo.create({ name: 'A', workspace_id: ws.id, external_key: 'dup' })
    expect(() =>
      collectionsRepo.create({ name: 'B', workspace_id: ws.id, external_key: 'dup' })
    ).toThrow(/UNIQUE/i)
  })

  it('permits same external_key in different workspaces', () => {
    const ws1 = workspacesRepo.create({ name: 'WS1' })
    const ws2 = workspacesRepo.create({ name: 'WS2' })
    collectionsRepo.create({ name: 'A', workspace_id: ws1.id, external_key: 'shared' })
    expect(() =>
      collectionsRepo.create({ name: 'B', workspace_id: ws2.id, external_key: 'shared' })
    ).not.toThrow()
  })

  it('update preserves external_key when not provided', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'A', workspace_id: ws.id, external_key: 'a' })
    collectionsRepo.update(col.id, { name: 'A2' })
    const reread = collectionsRepo.findById(col.id)!
    expect(reread.external_key).toBe('a')
    expect(reread.name).toBe('A2')
  })

  it('update can set external_key to null explicitly', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'A', workspace_id: ws.id, external_key: 'a' })
    collectionsRepo.update(col.id, { external_key: null })
    expect(collectionsRepo.findById(col.id)!.external_key).toBeNull()
  })
})

describe('folders.external_key', () => {
  it('round-trips on create and findByExternalKey resolves within collection', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id })
    const folder = foldersRepo.create({ collection_id: col.id, name: 'F', external_key: 'f1' })
    expect(folder.external_key).toBe('f1')
    expect(foldersRepo.findByExternalKey(col.id, 'f1')?.id).toBe(folder.id)
  })

  it('permits same external_key in different collections', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col1 = collectionsRepo.create({ name: 'C1', workspace_id: ws.id })
    const col2 = collectionsRepo.create({ name: 'C2', workspace_id: ws.id })
    foldersRepo.create({ collection_id: col1.id, name: 'F', external_key: 'shared' })
    expect(() =>
      foldersRepo.create({ collection_id: col2.id, name: 'F', external_key: 'shared' })
    ).not.toThrow()
  })

  it('rejects duplicate external_key within same collection', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id })
    foldersRepo.create({ collection_id: col.id, name: 'A', external_key: 'dup' })
    expect(() =>
      foldersRepo.create({ collection_id: col.id, name: 'B', external_key: 'dup' })
    ).toThrow(/UNIQUE/i)
  })
})

describe('requests.external_key', () => {
  it('round-trips on create and findByExternalKey resolves within collection', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id })
    const req = requestsRepo.create({ collection_id: col.id, name: 'R', external_key: 'r1' })
    expect(req.external_key).toBe('r1')
    expect(requestsRepo.findByExternalKey(col.id, 'r1')?.id).toBe(req.id)
  })

  it('uniqueness is scoped to collection, not folder (same key can move folders)', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id })
    const f1 = foldersRepo.create({ collection_id: col.id, name: 'F1' })
    const f2 = foldersRepo.create({ collection_id: col.id, name: 'F2' })

    const req = requestsRepo.create({
      collection_id: col.id, folder_id: f1.id, name: 'R', external_key: 'r1',
    })
    // Same external_key in a different folder of the same collection is a conflict.
    expect(() =>
      requestsRepo.create({
        collection_id: col.id, folder_id: f2.id, name: 'R2', external_key: 'r1',
      })
    ).toThrow(/UNIQUE/i)

    // But updating the original request to live in f2 must succeed — same row, no new conflict.
    requestsRepo.update(req.id, { folder_id: f2.id })
    expect(requestsRepo.findById(req.id)!.folder_id).toBe(f2.id)
  })

  it('permits same external_key in different collections', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col1 = collectionsRepo.create({ name: 'C1', workspace_id: ws.id })
    const col2 = collectionsRepo.create({ name: 'C2', workspace_id: ws.id })
    requestsRepo.create({ collection_id: col1.id, name: 'R', external_key: 'r' })
    expect(() =>
      requestsRepo.create({ collection_id: col2.id, name: 'R', external_key: 'r' })
    ).not.toThrow()
  })
})

describe('environments.external_key', () => {
  it('round-trips on create and findByExternalKey resolves within workspace', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const env = environmentsRepo.create({ workspace_id: ws.id, name: 'prod', external_key: 'prod' })
    expect(env.external_key).toBe('prod')
    expect(environmentsRepo.findByExternalKey(ws.id, 'prod')?.id).toBe(env.id)
  })

  it('uniqueness is scoped to workspace, not parent_id (child can be reparented)', () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const root1 = environmentsRepo.create({ workspace_id: ws.id, name: 'r1' })
    const root2 = environmentsRepo.create({ workspace_id: ws.id, name: 'r2' })

    environmentsRepo.create({
      workspace_id: ws.id, parent_id: root1.id, name: 'leaf', external_key: 'leaf',
    })
    // Same external_key under a different parent is a conflict (workspace-scoped).
    expect(() =>
      environmentsRepo.create({
        workspace_id: ws.id, parent_id: root2.id, name: 'leaf', external_key: 'leaf',
      })
    ).toThrow(/UNIQUE/i)
  })

  it('rejects duplicate external_key within same workspace, allows across workspaces', () => {
    const ws1 = workspacesRepo.create({ name: 'WS1' })
    const ws2 = workspacesRepo.create({ name: 'WS2' })
    environmentsRepo.create({ workspace_id: ws1.id, name: 'A', external_key: 'shared' })
    expect(() =>
      environmentsRepo.create({ workspace_id: ws1.id, name: 'B', external_key: 'shared' })
    ).toThrow(/UNIQUE/i)
    expect(() =>
      environmentsRepo.create({ workspace_id: ws2.id, name: 'B', external_key: 'shared' })
    ).not.toThrow()
  })
})

describe('migration 009', () => {
  it('creates partial unique indexes that ignore NULL', () => {
    const db = getDatabase()
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_%_external_key'
      ORDER BY name
    `).all() as { name: string }[]
    expect(indexes.map((r) => r.name)).toEqual([
      'idx_collections_external_key',
      'idx_environments_external_key',
      'idx_folders_external_key',
      'idx_requests_external_key',
    ])
  })
})
