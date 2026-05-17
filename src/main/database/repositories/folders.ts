import { v4 as uuid } from 'uuid'
import { getDatabase } from '../connection'
import { encryptValue, decryptValue } from '../../services/encryption'
import type { Folder, AuthConfig } from '../../../shared/types/models'

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

function decryptFolder(folder: Folder): Folder {
  return { ...folder, auth: decryptAuth(folder.auth) }
}

export function create(data: {
  collection_id: string
  name: string
  parent_id?: string
  external_key?: string | null
}): Folder {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO folders (id, collection_id, parent_id, name, "order", external_key, created_at, updated_at)
    VALUES (?, ?, ?, ?,
      (SELECT COALESCE(MAX("order"), 0) + 1 FROM folders
       WHERE collection_id = ? AND parent_id IS ?),
      ?, ?, ?)
  `).run(
    id,
    data.collection_id,
    data.parent_id ?? null,
    data.name,
    data.collection_id,
    data.parent_id ?? null,
    data.external_key ?? null,
    now,
    now
  )

  return findById(id)!
}

export function findByExternalKey(collectionId: string, externalKey: string): Folder | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM folders WHERE collection_id = ? AND external_key = ?')
    .get(collectionId, externalKey) as Folder | undefined
  return row ? decryptFolder(row) : undefined
}

export function findById(id: string): Folder | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder | undefined
  return row ? decryptFolder(row) : undefined
}

export function findByCollection(collectionId: string): Folder[] {
  const db = getDatabase()
  return (db
    .prepare('SELECT * FROM folders WHERE collection_id = ? ORDER BY "order" ASC')
    .all(collectionId) as Folder[]).map(decryptFolder)
}

export function findByParent(parentId: string | null, collectionId: string): Folder[] {
  const db = getDatabase()
  if (parentId) {
    return (db
      .prepare('SELECT * FROM folders WHERE parent_id = ? AND collection_id = ? ORDER BY "order" ASC')
      .all(parentId, collectionId) as Folder[]).map(decryptFolder)
  }
  return (db
    .prepare('SELECT * FROM folders WHERE parent_id IS NULL AND collection_id = ? ORDER BY "order" ASC')
    .all(collectionId) as Folder[]).map(decryptFolder)
}

export function update(
  id: string,
  data: Partial<Pick<Folder, 'name' | 'parent_id' | 'order' | 'environment_ids' | 'default_environment_id' | 'auth' | 'scripts' | 'external_key'>>
): Folder | undefined {
  const db = getDatabase()
  const existing = findById(id)
  if (!existing) return undefined

  const auth = data.auth !== undefined
    ? encryptAuth(data.auth)
    : encryptAuth(existing.auth)

  db.prepare(`
    UPDATE folders SET
      name = ?,
      parent_id = ?,
      "order" = ?,
      environment_ids = ?,
      default_environment_id = ?,
      auth = ?,
      scripts = ?,
      external_key = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.parent_id !== undefined ? data.parent_id : existing.parent_id,
    data.order ?? existing.order,
    data.environment_ids ?? existing.environment_ids,
    data.default_environment_id ?? existing.default_environment_id,
    auth,
    data.scripts ?? existing.scripts,
    data.external_key !== undefined ? data.external_key : existing.external_key,
    new Date().toISOString(),
    id
  )

  return findById(id)!
}

export function remove(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  return result.changes > 0
}

export function reorder(ids: string[]): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE folders SET "order" = ?, updated_at = ? WHERE id = ?')
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id)
    })
  })

  run()
}
