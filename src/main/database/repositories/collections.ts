import { v4 as uuid } from 'uuid'
import { getDatabase } from '../connection'
import { encryptValue, decryptValue } from '../../services/encryption'
import type { Collection, AuthConfig } from '../../../shared/types/models'

const ENC_PREFIX = 'enc:'

const AUTH_SENSITIVE_FIELDS: (keyof AuthConfig)[] = [
  'bearer_token',
  'basic_username',
  'basic_password',
  'api_key_value',
  'oauth2_client_secret',
  'oauth2_password',
  'oauth2_access_token',
  'oauth2_refresh_token',
]

function encryptAuth(json: string | null): string | null {
  if (!json) return json
  const auth: AuthConfig = JSON.parse(json)
  for (const field of AUTH_SENSITIVE_FIELDS) {
    const val = auth[field]
    if (typeof val === 'string' && val && !val.startsWith(ENC_PREFIX)) {
      ;(auth as Record<string, string>)[field] = ENC_PREFIX + encryptValue(val)
    }
  }
  return JSON.stringify(auth)
}

function decryptAuth(json: string | null): string | null {
  if (!json) return json
  const auth: AuthConfig = JSON.parse(json)
  for (const field of AUTH_SENSITIVE_FIELDS) {
    const val = auth[field]
    if (typeof val === 'string' && val.startsWith(ENC_PREFIX)) {
      try {
        ;(auth as Record<string, string>)[field] = decryptValue(val.slice(ENC_PREFIX.length))
      } catch {
        // corrupted — leave as-is
      }
    }
  }
  return JSON.stringify(auth)
}

function decryptCollection(col: Collection): Collection {
  return { ...col, auth: decryptAuth(col.auth) }
}

export function create(data: { name: string; workspace_id?: string; description?: string; external_key?: string | null }): Collection {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  // Shift existing collections down and insert at the top
  db.prepare(`UPDATE collections SET "order" = "order" + 1 WHERE workspace_id IS ?`)
    .run(data.workspace_id ?? null)

  db.prepare(`
    INSERT INTO collections (id, workspace_id, name, description, "order", external_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, data.workspace_id ?? null, data.name, data.description ?? null, data.external_key ?? null, now, now)

  return findById(id)!
}

export function findByExternalKey(workspaceId: string | null, externalKey: string): Collection | undefined {
  const db = getDatabase()
  const row = workspaceId
    ? db.prepare('SELECT * FROM collections WHERE workspace_id = ? AND external_key = ?')
        .get(workspaceId, externalKey) as Collection | undefined
    : db.prepare('SELECT * FROM collections WHERE workspace_id IS NULL AND external_key = ?')
        .get(externalKey) as Collection | undefined
  return row ? decryptCollection(row) : undefined
}

export function findById(id: string): Collection | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Collection | undefined
  return row ? decryptCollection(row) : undefined
}

export function findByWorkspace(workspaceId: string | null): Collection[] {
  const db = getDatabase()
  if (workspaceId) {
    return (db.prepare('SELECT * FROM collections WHERE workspace_id = ? ORDER BY "order" ASC').all(workspaceId) as Collection[]).map(decryptCollection)
  }
  return (db.prepare('SELECT * FROM collections WHERE workspace_id IS NULL ORDER BY "order" ASC').all() as Collection[]).map(decryptCollection)
}

export function findAll(): Collection[] {
  const db = getDatabase()
  return (db.prepare('SELECT * FROM collections ORDER BY "order" ASC').all() as Collection[]).map(decryptCollection)
}

export function update(id: string, data: Partial<Omit<Collection, 'id' | 'created_at'>>): Collection | undefined {
  const db = getDatabase()
  const existing = findById(id)
  if (!existing) return undefined

  const auth = data.auth !== undefined
    ? encryptAuth(data.auth)
    : encryptAuth(existing.auth)

  db.prepare(`
    UPDATE collections SET
      workspace_id = ?,
      name = ?,
      description = ?,
      "order" = ?,
      variables = ?,
      remote_sha = ?,
      remote_synced_at = ?,
      is_dirty = ?,
      sync_enabled = ?,
      environment_ids = ?,
      default_environment_id = ?,
      auth = ?,
      scripts = ?,
      file_shas = ?,
      external_key = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.workspace_id ?? existing.workspace_id,
    data.name ?? existing.name,
    data.description ?? existing.description,
    data.order ?? existing.order,
    data.variables ?? existing.variables,
    data.remote_sha ?? existing.remote_sha,
    data.remote_synced_at ?? existing.remote_synced_at,
    data.is_dirty ?? existing.is_dirty,
    data.sync_enabled ?? existing.sync_enabled,
    data.environment_ids ?? existing.environment_ids,
    data.default_environment_id ?? existing.default_environment_id,
    auth,
    data.scripts ?? existing.scripts,
    data.file_shas ?? existing.file_shas,
    data.external_key !== undefined ? data.external_key : existing.external_key,
    new Date().toISOString(),
    id
  )

  return findById(id)!
}

export function remove(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  return result.changes > 0
}

export function reorder(ids: string[]): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE collections SET "order" = ?, updated_at = ? WHERE id = ?')
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id)
    })
  })

  run()
}

export function findSyncEnabled(workspaceId?: string): Collection[] {
  const db = getDatabase()
  if (workspaceId) {
    return (db.prepare('SELECT * FROM collections WHERE sync_enabled = 1 AND workspace_id = ? ORDER BY "order" ASC').all(workspaceId) as Collection[]).map(decryptCollection)
  }
  return (db.prepare('SELECT * FROM collections WHERE sync_enabled = 1 AND workspace_id IS NULL ORDER BY "order" ASC').all() as Collection[]).map(decryptCollection)
}

export function unlinkSync(id: string): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE collections
    SET sync_enabled = 0, remote_sha = NULL, file_shas = NULL, remote_synced_at = NULL, is_dirty = 0, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id)
}

export function markDirty(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE collections SET is_dirty = 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id)
}

export function clearDirty(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE collections SET is_dirty = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id)
}
