/**
 * Tests for the agent-socket upsert methods. Calls dispatch() directly with
 * a synthesized JSON-RPC request rather than going through a real socket —
 * the socket framing is exercised by tests/unit/agent-socket.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    getVersion: () => '0.0.0-test',
  },
  // Upsert methods broadcast a data-changed event to renderer windows; in tests
  // there are none, so getAllWindows() returns an empty array.
  BrowserWindow: { getAllWindows: () => [] },
}))

import { openTestDatabase, closeDatabase, getDatabase } from '../../src/main/database/connection'
import { initEncryptionForTesting } from '../../src/main/services/encryption'
import * as workspacesRepo from '../../src/main/database/repositories/workspaces'
import * as collectionsRepo from '../../src/main/database/repositories/collections'
import * as foldersRepo from '../../src/main/database/repositories/folders'
import * as requestsRepo from '../../src/main/database/repositories/requests'
import * as environmentsRepo from '../../src/main/database/repositories/environments'
import { dispatch, clearMethods } from '../../src/main/services/agent-socket/router'
import { setCurrentToken } from '../../src/main/services/agent-socket/auth'
import { registerUpsertCollection } from '../../src/main/services/agent-socket/methods/upsert-collection'
import { registerUpsertFolder } from '../../src/main/services/agent-socket/methods/upsert-folder'
import { registerUpsertRequest } from '../../src/main/services/agent-socket/methods/upsert-request'
import { registerUpsertEnv } from '../../src/main/services/agent-socket/methods/upsert-env'
import { registerUpsertEnvVariable } from '../../src/main/services/agent-socket/methods/upsert-env-variable'

const TOKEN = 'test-token'

interface SuccessReply {
  result: { id: string; external_key: string; created: boolean; updated_at: string }
}

interface ErrorReply {
  error: { code: number; message: string }
}

async function call(method: string, params: Record<string, unknown>): Promise<SuccessReply | ErrorReply> {
  const reply = await dispatch({
    jsonrpc: '2.0',
    id: 1,
    method,
    auth: TOKEN,
    params,
  })
  return reply as SuccessReply | ErrorReply
}

function expectSuccess(reply: SuccessReply | ErrorReply): SuccessReply['result'] {
  if ('error' in reply) {
    throw new Error(`Expected success, got error ${reply.error.code}: ${reply.error.message}`)
  }
  return reply.result
}

beforeEach(() => {
  openTestDatabase()
  initEncryptionForTesting()
  clearMethods()
  setCurrentToken(TOKEN)
  registerUpsertCollection()
  registerUpsertFolder()
  registerUpsertRequest()
  registerUpsertEnv()
  registerUpsertEnvVariable()
})

afterEach(() => {
  closeDatabase()
})

describe('upsert.collection', () => {
  it('creates a collection on first call, updates on second', async () => {
    workspacesRepo.create({ name: 'WS' })

    const first = expectSuccess(await call('upsert.collection', {
      external_key: 'acme', name: 'Acme',
    }))
    expect(first.created).toBe(true)

    const second = expectSuccess(await call('upsert.collection', {
      external_key: 'acme', name: 'Acme Renamed',
    }))
    expect(second.created).toBe(false)
    expect(second.id).toBe(first.id)
    expect(collectionsRepo.findById(first.id)!.name).toBe('Acme Renamed')
  })

  it('preserves omitted fields on update', async () => {
    workspacesRepo.create({ name: 'WS' })
    const created = expectSuccess(await call('upsert.collection', {
      external_key: 'k', name: 'Original', description: 'desc',
    }))
    await call('upsert.collection', { external_key: 'k' })
    const after = collectionsRepo.findById(created.id)!
    expect(after.name).toBe('Original')
    expect(after.description).toBe('desc')
  })

  it('requires name on create, not on update', async () => {
    workspacesRepo.create({ name: 'WS' })
    const reply = await call('upsert.collection', { external_key: 'unknown' })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32003)
  })
})

describe('upsert.folder', () => {
  it('creates a folder and resolves the collection by external_key', async () => {
    workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))

    const folder = expectSuccess(await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'auth', name: 'Auth',
    }))
    expect(folder.created).toBe(true)
    expect(foldersRepo.findById(folder.id)!.name).toBe('Auth')
  })

  it('errors with NOT_FOUND when collection_external_key is unknown', async () => {
    workspacesRepo.create({ name: 'WS' })
    const reply = await call('upsert.folder', {
      collection_external_key: 'missing', external_key: 'auth', name: 'X',
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002)
  })

  it('reparents an existing folder when parent_folder_external_key changes', async () => {
    workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))
    const parent = expectSuccess(await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'parent', name: 'Parent',
    }))
    const leaf = expectSuccess(await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'leaf', name: 'Leaf',
      parent_folder_external_key: 'parent',
    }))
    expect(foldersRepo.findById(leaf.id)!.parent_id).toBe(parent.id)

    // Move leaf to root.
    await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'leaf',
      parent_folder_external_key: '',
    })
    expect(foldersRepo.findById(leaf.id)!.parent_id).toBeNull()
  })
})

describe('upsert.request', () => {
  it('creates a request, then updates url + headers + body without losing other fields', async () => {
    workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))

    const created = expectSuccess(await call('upsert.request', {
      collection_external_key: 'col', external_key: 'users.list',
      name: 'List users', method: 'GET', url: 'https://api.example.com/users',
      headers: [{ key: 'X-Foo', value: 'bar', enabled: true }],
    }))
    expect(created.created).toBe(true)
    const row1 = requestsRepo.findById(created.id)!
    expect(row1.url).toBe('https://api.example.com/users')
    expect(row1.method).toBe('GET')
    expect(JSON.parse(row1.headers!)).toEqual([{ key: 'X-Foo', value: 'bar', enabled: true }])

    expectSuccess(await call('upsert.request', {
      collection_external_key: 'col', external_key: 'users.list',
      url: 'https://api.example.com/v2/users',
      body: { greeting: 'hi' },
    }))
    const row2 = requestsRepo.findById(created.id)!
    expect(row2.url).toBe('https://api.example.com/v2/users')
    expect(row2.name).toBe('List users') // preserved
    expect(row2.method).toBe('GET') // preserved
    expect(JSON.parse(row2.headers!)).toEqual([{ key: 'X-Foo', value: 'bar', enabled: true }]) // preserved
    expect(JSON.parse(row2.body!)).toEqual({ greeting: 'hi' })
  })

  it('moves a request between folders within the same collection (valid)', async () => {
    workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))
    expectSuccess(await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'f1', name: 'F1',
    }))
    expectSuccess(await call('upsert.folder', {
      collection_external_key: 'col', external_key: 'f2', name: 'F2',
    }))

    const r = expectSuccess(await call('upsert.request', {
      collection_external_key: 'col', external_key: 'r',
      name: 'R', folder_external_key: 'f1',
    }))
    const f1Id = requestsRepo.findById(r.id)!.folder_id
    expect(f1Id).not.toBeNull()

    expectSuccess(await call('upsert.request', {
      collection_external_key: 'col', external_key: 'r',
      folder_external_key: 'f2',
    }))
    const f2Id = requestsRepo.findById(r.id)!.folder_id
    expect(f2Id).not.toBe(f1Id)
  })

  it('encrypts bearer tokens transparently via the repo', async () => {
    workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))
    const r = expectSuccess(await call('upsert.request', {
      collection_external_key: 'col', external_key: 'r',
      name: 'R',
      auth: { type: 'bearer', bearer_token: 'super-secret-12345' },
    }))

    // Raw DB read shows ciphertext (enc: prefix on the bearer_token field).
    const dbRow = getDatabase().prepare('SELECT auth FROM requests WHERE id = ?').get(r.id) as { auth: string }
    expect(dbRow.auth).toContain('enc:')

    // findById decrypts back to plaintext.
    const decrypted = JSON.parse(requestsRepo.findById(r.id)!.auth!)
    expect(decrypted.bearer_token).toBe('super-secret-12345')
  })
})

describe('upsert.env', () => {
  it('creates an env, then updates variables', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })

    const created = expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'prod', name: 'Prod',
      variables: [{ key: 'API_KEY', value: 'k1', enabled: true }],
    }))
    expect(created.created).toBe(true)

    expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'prod',
      variables: [{ key: 'API_KEY', value: 'k2', enabled: true }],
    }))

    const env = environmentsRepo.findById(created.id)!
    const vars = JSON.parse(env.variables)
    expect(vars[0].value).toBe('k2') // findById decrypts
  })

  it('attaches a child env to a parent by external_key', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const parent = expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'base', name: 'Base',
    }))
    const child = expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'local', name: 'Local',
      parent_external_key: 'base',
    }))
    expect(environmentsRepo.findById(child.id)!.parent_id).toBe(parent.id)
  })

  it('errors NOT_FOUND when parent env does not exist', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const reply = await call('upsert.env', {
      workspace_id: ws.id, external_key: 'child', name: 'C',
      parent_external_key: 'no-such-parent',
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002)
  })
})

describe('upsert.env_variable', () => {
  it('adds a new variable without disturbing existing ones', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'e', name: 'E',
      variables: [
        { key: 'API_KEY', value: 'k1', enabled: true },
        { key: 'BASE_URL', value: 'http://localhost:3000', enabled: true },
      ],
    }))

    const r = expectSuccess(await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e',
      key: 'TIMEOUT', value: '30',
    }))
    expect(r.created).toBe(true)

    const env = environmentsRepo.findByExternalKey(ws.id, 'e')!
    const vars = JSON.parse(env.variables) as Array<{ key: string; value: string; enabled: boolean }>
    expect(vars).toHaveLength(3)
    // pre-existing values must be intact (proves we didn't wipe what we couldn't see)
    expect(vars.find((v) => v.key === 'API_KEY')!.value).toBe('k1')
    expect(vars.find((v) => v.key === 'BASE_URL')!.value).toBe('http://localhost:3000')
    expect(vars.find((v) => v.key === 'TIMEOUT')!.value).toBe('30')
    expect(vars.find((v) => v.key === 'TIMEOUT')!.enabled).toBe(true)
  })

  it('updates an existing variable in place, preserving its position', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', {
      workspace_id: ws.id, external_key: 'e', name: 'E',
      variables: [
        { key: 'A', value: 'a1', enabled: true },
        { key: 'B', value: 'b1', enabled: true },
        { key: 'C', value: 'c1', enabled: true },
      ],
    }))

    const r = expectSuccess(await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e',
      key: 'B', value: 'b2-rotated',
    }))
    expect(r.created).toBe(false)

    const env = environmentsRepo.findByExternalKey(ws.id, 'e')!
    const vars = JSON.parse(env.variables) as Array<{ key: string; value: string }>
    expect(vars.map((v) => v.key)).toEqual(['A', 'B', 'C'])
    expect(vars[1].value).toBe('b2-rotated')
    expect(vars[0].value).toBe('a1')
    expect(vars[2].value).toBe('c1')
  })

  it('honors enabled: false', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', { workspace_id: ws.id, external_key: 'e', name: 'E' }))
    expectSuccess(await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e',
      key: 'OFF', value: 'x', enabled: false,
    }))
    const vars = JSON.parse(environmentsRepo.findByExternalKey(ws.id, 'e')!.variables) as Array<{ enabled: boolean }>
    expect(vars[0].enabled).toBe(false)
  })

  it('accepts empty string as a value', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', { workspace_id: ws.id, external_key: 'e', name: 'E' }))
    expectSuccess(await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e',
      key: 'EMPTY', value: '',
    }))
    const vars = JSON.parse(environmentsRepo.findByExternalKey(ws.id, 'e')!.variables) as Array<{ value: string }>
    expect(vars[0].value).toBe('')
  })

  it('encrypts the value at rest (raw DB row carries enc: prefix)', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', { workspace_id: ws.id, external_key: 'e', name: 'E' }))
    expectSuccess(await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e',
      key: 'SECRET', value: 'plaintext-secret-xyz',
    }))
    const rawRow = getDatabase().prepare('SELECT variables FROM environments WHERE external_key = ?').get('e') as { variables: string }
    expect(rawRow.variables).toContain('enc:')
    expect(rawRow.variables).not.toContain('plaintext-secret-xyz')
  })

  it('errors NOT_FOUND when env_external_key is unknown', async () => {
    workspacesRepo.create({ name: 'WS' })
    const reply = await call('upsert.env_variable', {
      env_external_key: 'nope', key: 'X', value: 'y',
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002)
  })

  it('errors VALIDATION when value is missing', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.env', { workspace_id: ws.id, external_key: 'e', name: 'E' }))
    const reply = await call('upsert.env_variable', {
      workspace_id: ws.id, env_external_key: 'e', key: 'NO_VALUE',
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32003)
  })
})

describe('adopt by id (UI-created entities with no external_key)', () => {
  it('adopts a UI-created collection under a new external_key instead of duplicating', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    // Simulate a collection made in the UI: no external_key.
    const uiCol = collectionsRepo.create({ name: 'Made in UI', workspace_id: ws.id })
    expect(uiCol.external_key).toBeNull()

    const adopted = expectSuccess(await call('upsert.collection', {
      id: uiCol.id, external_key: 'acme', name: 'Made in UI',
    }))
    expect(adopted.created).toBe(false)
    expect(adopted.id).toBe(uiCol.id)
    expect(adopted.external_key).toBe('acme')
    expect(collectionsRepo.findById(uiCol.id)!.external_key).toBe('acme')
    // No duplicate was created.
    expect(collectionsRepo.findByWorkspace(ws.id)).toHaveLength(1)

    // Subsequent key-based upserts now find it.
    const again = expectSuccess(await call('upsert.collection', {
      external_key: 'acme', name: 'Renamed',
    }))
    expect(again.id).toBe(uiCol.id)
    expect(again.created).toBe(false)
  })

  it('rejects adoption when the external_key is already taken by another collection', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    expectSuccess(await call('upsert.collection', { external_key: 'taken', name: 'Existing' }))
    const uiCol = collectionsRepo.create({ name: 'Made in UI', workspace_id: ws.id })

    const reply = await call('upsert.collection', { id: uiCol.id, external_key: 'taken', name: 'X' })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32004) // CONFLICT
  })

  it('returns NOT_FOUND when the id does not exist', async () => {
    workspacesRepo.create({ name: 'WS' })
    const reply = await call('upsert.collection', { id: 'no-such-id', external_key: 'k', name: 'X' })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002) // NOT_FOUND
  })

  it('adopts a UI-created folder by id', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))
    const uiFolder = foldersRepo.create({ collection_id: col.id, name: 'UI Folder' })
    expect(uiFolder.external_key).toBeNull()

    const adopted = expectSuccess(await call('upsert.folder', {
      id: uiFolder.id, collection_external_key: 'col', external_key: 'auth', name: 'UI Folder',
    }))
    expect(adopted.created).toBe(false)
    expect(adopted.id).toBe(uiFolder.id)
    expect(foldersRepo.findById(uiFolder.id)!.external_key).toBe('auth')
    void ws
  })

  it('adopts a UI-created request by id', async () => {
    workspacesRepo.create({ name: 'WS' })
    const col = expectSuccess(await call('upsert.collection', { external_key: 'col', name: 'Col' }))
    const uiReq = requestsRepo.create({ collection_id: col.id, name: 'UI Req', method: 'GET' })
    expect(uiReq.external_key).toBeNull()

    const adopted = expectSuccess(await call('upsert.request', {
      id: uiReq.id, collection_external_key: 'col', external_key: 'users.list', name: 'UI Req',
    }))
    expect(adopted.created).toBe(false)
    expect(adopted.id).toBe(uiReq.id)
    expect(requestsRepo.findById(uiReq.id)!.external_key).toBe('users.list')
  })

  it('adopts a UI-created environment by id', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const uiEnv = environmentsRepo.create({ name: 'UI Env', workspace_id: ws.id })
    expect(uiEnv.external_key).toBeNull()

    const adopted = expectSuccess(await call('upsert.env', {
      id: uiEnv.id, external_key: 'prod', name: 'UI Env',
    }))
    expect(adopted.created).toBe(false)
    expect(adopted.id).toBe(uiEnv.id)
    expect(environmentsRepo.findById(uiEnv.id)!.external_key).toBe('prod')
  })

  it('rejects an id from a different collection (out of scope)', async () => {
    workspacesRepo.create({ name: 'WS' })
    const colA = expectSuccess(await call('upsert.collection', { external_key: 'a', name: 'A' }))
    expectSuccess(await call('upsert.collection', { external_key: 'b', name: 'B' }))
    const folderInA = foldersRepo.create({ collection_id: colA.id, name: 'F' })

    // Try to adopt folderInA while targeting collection "b".
    const reply = await call('upsert.folder', {
      id: folderInA.id, collection_external_key: 'b', external_key: 'f', name: 'F',
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002) // NOT_FOUND (not in scope)
  })
})

describe('auth gate', () => {
  it('rejects upsert calls with a wrong token', async () => {
    workspacesRepo.create({ name: 'WS' })
    const reply = await dispatch({
      jsonrpc: '2.0', id: 1, method: 'upsert.collection',
      auth: 'wrong',
      params: { external_key: 'k', name: 'X' },
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32001)
  })
})
