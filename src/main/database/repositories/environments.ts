import { v4 as uuid } from 'uuid'
import { getDatabase } from '../connection'
import { encryptValue, decryptValue } from '../../services/encryption'
import type { Environment, EnvironmentVariable } from '../../../shared/types/models'

const ENC_PREFIX = 'enc:'

function encryptVariables(json: string): string {
  if (!json || json === '[]') return json
  const vars: EnvironmentVariable[] = JSON.parse(json)
  return JSON.stringify(
    vars.map((v) => ({
      ...v,
      value: v.value ? ENC_PREFIX + encryptValue(v.value) : v.value,
    }))
  )
}

function decryptVariables(json: string): string {
  if (!json || json === '[]') return json
  const vars: EnvironmentVariable[] = JSON.parse(json)
  return JSON.stringify(
    vars.map((v) => {
      if (v.value && v.value.startsWith(ENC_PREFIX)) {
        try {
          return { ...v, value: decryptValue(v.value.slice(ENC_PREFIX.length)) }
        } catch {
          return v // corrupted — return as-is
        }
      }
      return v
    })
  )
}

function decryptEnvironment(env: Environment): Environment {
  return { ...env, variables: decryptVariables(env.variables) }
}

/**
 * Validate a proposed parent_id for a target env (or null target for create).
 * Throws if the relationship would violate the 2-level cap or be cross-workspace.
 */
function validateParent(
  parentId: string | null,
  targetWorkspaceId: string | null,
  targetId: string | null,
): void {
  if (!parentId) return

  if (targetId && parentId === targetId) {
    throw new Error('Environment cannot be its own parent')
  }

  const db = getDatabase()
  const parent = db.prepare('SELECT id, parent_id, workspace_id FROM environments WHERE id = ?')
    .get(parentId) as { id: string; parent_id: string | null; workspace_id: string | null } | undefined

  if (!parent) {
    throw new Error(`Parent environment ${parentId} not found`)
  }

  if ((parent.workspace_id ?? null) !== (targetWorkspaceId ?? null)) {
    throw new Error('Parent and child must belong to the same workspace')
  }

  if (parent.parent_id !== null) {
    throw new Error('Parent environment is already a child (max depth is 2)')
  }

  if (targetId) {
    const hasChildren = db.prepare('SELECT 1 FROM environments WHERE parent_id = ? LIMIT 1')
      .get(targetId)
    if (hasChildren) {
      throw new Error('Environment has children and cannot become a child itself')
    }
  }
}

export function create(data: {
  name: string
  workspace_id?: string
  parent_id?: string | null
  variables?: string
  external_key?: string | null
}): Environment {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  const workspaceId = data.workspace_id ?? null
  const parentId = data.parent_id ?? null

  validateParent(parentId, workspaceId, null)

  const variables = data.variables ? encryptVariables(data.variables) : '[]'

  db.prepare(`
    INSERT INTO environments (id, workspace_id, parent_id, name, variables, "order", external_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?,
      (SELECT COALESCE(MAX("order"), 0) + 1 FROM environments
        WHERE workspace_id IS ? AND parent_id IS ?),
      ?, ?, ?)
  `).run(id, workspaceId, parentId, data.name, variables, workspaceId, parentId, data.external_key ?? null, now, now)

  return findById(id)!
}

export function findByExternalKey(workspaceId: string | null, externalKey: string): Environment | undefined {
  const db = getDatabase()
  const row = workspaceId
    ? db.prepare('SELECT * FROM environments WHERE workspace_id = ? AND external_key = ?')
        .get(workspaceId, externalKey) as Environment | undefined
    : db.prepare('SELECT * FROM environments WHERE workspace_id IS NULL AND external_key = ?')
        .get(externalKey) as Environment | undefined
  return row ? decryptEnvironment(row) : undefined
}

export function findById(id: string): Environment | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as Environment | undefined
  return row ? decryptEnvironment(row) : undefined
}

export function findByWorkspace(workspaceId: string | null): Environment[] {
  const db = getDatabase()
  const rows = workspaceId
    ? db.prepare('SELECT * FROM environments WHERE workspace_id = ? ORDER BY "order" ASC').all(workspaceId) as Environment[]
    : db.prepare('SELECT * FROM environments WHERE workspace_id IS NULL ORDER BY "order" ASC').all() as Environment[]
  return rows.map(decryptEnvironment)
}

export function findAll(): Environment[] {
  const db = getDatabase()
  return (db.prepare('SELECT * FROM environments ORDER BY "order" ASC').all() as Environment[]).map(decryptEnvironment)
}

export function findChildren(parentId: string): Environment[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM environments WHERE parent_id = ? ORDER BY "order" ASC')
    .all(parentId) as Environment[]
  return rows.map(decryptEnvironment)
}

export function findActive(workspaceId?: string): Environment | undefined {
  const db = getDatabase()
  const row = workspaceId
    ? db.prepare('SELECT * FROM environments WHERE is_active = 1 AND workspace_id = ? LIMIT 1').get(workspaceId) as Environment | undefined
    : db.prepare('SELECT * FROM environments WHERE is_active = 1 LIMIT 1').get() as Environment | undefined
  return row ? decryptEnvironment(row) : undefined
}

/**
 * Returns the chain root → … → env (length 1 or 2). Used for variable resolution
 * and vault preload. Order matters: earlier entries are overridden by later ones.
 */
export function findChain(envId: string): Environment[] {
  const env = findById(envId)
  if (!env) return []
  if (!env.parent_id) return [env]
  const parent = findById(env.parent_id)
  return parent ? [parent, env] : [env]
}

export function update(
  id: string,
  data: Partial<Omit<Environment, 'id' | 'created_at'>>
): Environment | undefined {
  const db = getDatabase()
  const existing = findById(id)
  if (!existing) return undefined

  // If parent_id is changing, validate the new value
  if (data.parent_id !== undefined && data.parent_id !== existing.parent_id) {
    const nextWorkspaceId = data.workspace_id !== undefined ? (data.workspace_id ?? null) : existing.workspace_id
    validateParent(data.parent_id ?? null, nextWorkspaceId, id)
  }

  // Re-encrypt variables if provided; existing.variables is already decrypted by findById
  const variables = data.variables
    ? encryptVariables(data.variables)
    : encryptVariables(existing.variables)

  db.prepare(`
    UPDATE environments SET
      workspace_id = ?,
      parent_id = ?,
      name = ?,
      variables = ?,
      is_active = ?,
      "order" = ?,
      vault_synced = ?,
      vault_path = ?,
      external_key = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.workspace_id !== undefined ? data.workspace_id : existing.workspace_id,
    data.parent_id !== undefined ? data.parent_id : existing.parent_id,
    data.name ?? existing.name,
    variables,
    data.is_active ?? existing.is_active,
    data.order ?? existing.order,
    data.vault_synced ?? existing.vault_synced,
    data.vault_path ?? existing.vault_path,
    data.external_key !== undefined ? data.external_key : existing.external_key,
    new Date().toISOString(),
    id
  )

  return findById(id)!
}

export function activate(id: string, workspaceId?: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    // Deactivate all in same workspace
    if (workspaceId) {
      db.prepare('UPDATE environments SET is_active = 0, updated_at = ? WHERE workspace_id = ?').run(now, workspaceId)
    } else {
      db.prepare('UPDATE environments SET is_active = 0, updated_at = ? WHERE workspace_id IS NULL').run(now)
    }
    // Activate the target
    db.prepare('UPDATE environments SET is_active = 1, updated_at = ? WHERE id = ?').run(now, id)
  })

  run()
}

export function deactivate(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE environments SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id)
}

export function remove(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM environments WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Reorder a flat list of ids. Order is scoped per (workspace_id, parent_id) sibling group,
 * so callers should pass ids that share the same parent.
 */
export function reorder(ids: string[]): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE environments SET "order" = ?, updated_at = ? WHERE id = ?')
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id)
    })
  })

  run()
}
