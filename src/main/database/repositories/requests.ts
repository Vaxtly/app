import { v4 as uuid } from 'uuid'
import { getDatabase } from '../connection'
import { encryptValue, decryptValue } from '../../services/encryption'
import type { Request, AuthConfig } from '../../../shared/types/models'

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

function decryptRequest(req: Request): Request {
  return { ...req, auth: decryptAuth(req.auth) }
}

export function create(data: {
  collection_id: string
  name: string
  folder_id?: string
  method?: string
  url?: string
  body_type?: string
  auth?: string
  external_key?: string | null
}): Request {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()
  const auth = encryptAuth(data.auth ?? JSON.stringify({ type: 'inherit' }))

  db.prepare(`
    INSERT INTO requests (id, collection_id, folder_id, name, url, method, body_type, auth, "order", external_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?,
      (SELECT COALESCE(MAX("order"), 0) + 1 FROM requests
       WHERE collection_id = ? AND folder_id IS ?),
      ?, ?, ?)
  `).run(
    id,
    data.collection_id,
    data.folder_id ?? null,
    data.name,
    data.url ?? '',
    data.method ?? 'GET',
    data.body_type ?? 'json',
    auth,
    data.collection_id,
    data.folder_id ?? null,
    data.external_key ?? null,
    now,
    now
  )

  return findById(id)!
}

export function findByExternalKey(collectionId: string, externalKey: string): Request | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM requests WHERE collection_id = ? AND external_key = ?')
    .get(collectionId, externalKey) as Request | undefined
  return row ? decryptRequest(row) : undefined
}

export function findById(id: string): Request | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Request | undefined
  return row ? decryptRequest(row) : undefined
}

export function findByCollection(collectionId: string): Request[] {
  const db = getDatabase()
  return (db
    .prepare('SELECT * FROM requests WHERE collection_id = ? ORDER BY "order" ASC')
    .all(collectionId) as Request[]).map(decryptRequest)
}

export function findByFolder(folderId: string | null, collectionId: string): Request[] {
  const db = getDatabase()
  const rows = folderId
    ? db.prepare('SELECT * FROM requests WHERE folder_id = ? AND collection_id = ? ORDER BY "order" ASC')
        .all(folderId, collectionId) as Request[]
    : db.prepare('SELECT * FROM requests WHERE folder_id IS NULL AND collection_id = ? ORDER BY "order" ASC')
        .all(collectionId) as Request[]
  return rows.map(decryptRequest)
}

export function update(
  id: string,
  data: Partial<Omit<Request, 'id' | 'created_at'>>
): Request | undefined {
  const db = getDatabase()
  const existing = findById(id)
  if (!existing) return undefined

  // Encrypt auth field; existing.auth is already decrypted by findById
  const auth = data.auth
    ? encryptAuth(data.auth)
    : encryptAuth(existing.auth)

  db.prepare(`
    UPDATE requests SET
      collection_id = ?,
      folder_id = ?,
      name = ?,
      url = ?,
      method = ?,
      headers = ?,
      query_params = ?,
      body = ?,
      body_type = ?,
      auth = ?,
      scripts = ?,
      "order" = ?,
      external_key = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.collection_id ?? existing.collection_id,
    data.folder_id !== undefined ? data.folder_id : existing.folder_id,
    data.name ?? existing.name,
    data.url ?? existing.url,
    data.method ?? existing.method,
    data.headers ?? existing.headers,
    data.query_params ?? existing.query_params,
    data.body ?? existing.body,
    data.body_type ?? existing.body_type,
    auth,
    data.scripts ?? existing.scripts,
    data.order ?? existing.order,
    data.external_key !== undefined ? data.external_key : existing.external_key,
    new Date().toISOString(),
    id
  )

  return findById(id)!
}

export function remove(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM requests WHERE id = ?').run(id)
  return result.changes > 0
}

export function move(id: string, targetFolderId: string | null, targetCollectionId?: string): Request | undefined {
  const db = getDatabase()
  const existing = findById(id)
  if (!existing) return undefined

  const collectionId = targetCollectionId ?? existing.collection_id

  // Get next order in target location
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX("order"), 0) as max_order FROM requests WHERE collection_id = ? AND folder_id IS ?'
  ).get(collectionId, targetFolderId) as { max_order: number }

  db.prepare(`
    UPDATE requests SET folder_id = ?, collection_id = ?, "order" = ?, updated_at = ? WHERE id = ?
  `).run(targetFolderId, collectionId, maxOrder.max_order + 1, new Date().toISOString(), id)

  return findById(id)!
}

export function reorder(ids: string[]): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE requests SET "order" = ?, updated_at = ? WHERE id = ?')
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id)
    })
  })

  run()
}
