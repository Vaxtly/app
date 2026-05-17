/**
 * Tests for the read (list/get) agent-socket methods. Hardcoded redaction
 * means there's no opt-in to see plaintext secrets — these tests are the
 * tripwire: if any change accidentally pipes a token through to the wire,
 * the explicit "never equals plaintext" asserts catch it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    getVersion: () => '0.0.0-test',
  },
}))

import { openTestDatabase, closeDatabase } from '../../src/main/database/connection'
import { initEncryptionForTesting } from '../../src/main/services/encryption'
import * as workspacesRepo from '../../src/main/database/repositories/workspaces'
import * as collectionsRepo from '../../src/main/database/repositories/collections'
import * as foldersRepo from '../../src/main/database/repositories/folders'
import * as requestsRepo from '../../src/main/database/repositories/requests'
import * as environmentsRepo from '../../src/main/database/repositories/environments'
import { dispatch, clearMethods } from '../../src/main/services/agent-socket/router'
import { setCurrentToken } from '../../src/main/services/agent-socket/auth'
import { registerListWorkspaces } from '../../src/main/services/agent-socket/methods/list-workspaces'
import { registerListCollections } from '../../src/main/services/agent-socket/methods/list-collections'
import { registerListFolders } from '../../src/main/services/agent-socket/methods/list-folders'
import { registerListRequests } from '../../src/main/services/agent-socket/methods/list-requests'
import { registerListEnvs } from '../../src/main/services/agent-socket/methods/list-envs'
import { registerGetCollection } from '../../src/main/services/agent-socket/methods/get-collection'
import { registerGetFolder } from '../../src/main/services/agent-socket/methods/get-folder'
import { registerGetRequest } from '../../src/main/services/agent-socket/methods/get-request'
import { registerGetEnv } from '../../src/main/services/agent-socket/methods/get-env'
import { REDACTED } from '../../src/main/services/agent-socket/methods/_redact'

const TOKEN = 'test-token'

async function call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const reply = await dispatch({
    jsonrpc: '2.0', id: 1, method, auth: TOKEN, params,
  })
  if ('error' in reply) {
    throw new Error(`${reply.error.code}: ${reply.error.message}`)
  }
  return reply.result as T
}

beforeEach(() => {
  openTestDatabase()
  initEncryptionForTesting()
  clearMethods()
  setCurrentToken(TOKEN)
  registerListWorkspaces()
  registerListCollections()
  registerListFolders()
  registerListRequests()
  registerListEnvs()
  registerGetCollection()
  registerGetFolder()
  registerGetRequest()
  registerGetEnv()
})

afterEach(() => {
  closeDatabase()
})

describe('list.workspaces', () => {
  it('returns all workspaces with id + name only', async () => {
    workspacesRepo.create({ name: 'A' })
    workspacesRepo.create({ name: 'B' })
    const result = await call<Array<{ id: string; name: string }>>('list.workspaces')
    expect(result.map((w) => w.name).sort()).toEqual(['A', 'B'])
    expect(Object.keys(result[0]).sort()).toEqual(['id', 'name'])
  })
})

describe('list.collections / list.folders / list.requests / list.envs', () => {
  it('list.collections returns slim shape (no auth, no scripts)', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    collectionsRepo.create({
      name: 'C', workspace_id: ws.id, external_key: 'c',
    })
    const result = await call<Array<Record<string, unknown>>>('list.collections')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ external_key: 'c', name: 'C' })
    expect(result[0]).not.toHaveProperty('auth')
    expect(result[0]).not.toHaveProperty('scripts')
  })

  it('list.folders includes parent_external_key for nested folders', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    const parent = foldersRepo.create({ collection_id: col.id, name: 'P', external_key: 'parent' })
    foldersRepo.create({ collection_id: col.id, name: 'L', external_key: 'leaf', parent_id: parent.id })

    const result = await call<Array<{ external_key: string; parent_external_key: string | null }>>(
      'list.folders', { collection_external_key: 'c' },
    )
    const leaf = result.find((f) => f.external_key === 'leaf')!
    expect(leaf.parent_external_key).toBe('parent')
    const root = result.find((f) => f.external_key === 'parent')!
    expect(root.parent_external_key).toBeNull()
  })

  it('list.requests honors folder_external_key filter', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    const f1 = foldersRepo.create({ collection_id: col.id, name: 'F1', external_key: 'f1' })
    foldersRepo.create({ collection_id: col.id, name: 'F2', external_key: 'f2' })
    requestsRepo.create({ collection_id: col.id, name: 'r1', folder_id: f1.id, external_key: 'r1' })
    requestsRepo.create({ collection_id: col.id, name: 'r2', external_key: 'r2' })

    const all = await call<unknown[]>('list.requests', { collection_external_key: 'c' })
    expect(all).toHaveLength(2)

    const inF1 = await call<unknown[]>('list.requests', {
      collection_external_key: 'c', folder_external_key: 'f1',
    })
    expect(inF1).toHaveLength(1)
    expect((inF1[0] as { external_key: string }).external_key).toBe('r1')

    const atRoot = await call<unknown[]>('list.requests', {
      collection_external_key: 'c', folder_external_key: '',
    })
    expect(atRoot).toHaveLength(1)
    expect((atRoot[0] as { external_key: string }).external_key).toBe('r2')
  })

  it('list.envs returns the parent chain', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const root = environmentsRepo.create({ workspace_id: ws.id, name: 'root', external_key: 'root' })
    environmentsRepo.create({ workspace_id: ws.id, parent_id: root.id, name: 'child', external_key: 'child' })
    const result = await call<Array<{ external_key: string; parent_external_key: string | null }>>(
      'list.envs',
    )
    const child = result.find((e) => e.external_key === 'child')!
    expect(child.parent_external_key).toBe('root')
  })
})

describe('redaction (the safety property)', () => {
  it('get.request masks bearer_token regardless of caller', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    requestsRepo.create({
      collection_id: col.id, name: 'R', external_key: 'r',
      auth: JSON.stringify({ type: 'bearer', bearer_token: 'PLAINTEXT-secret-987' }),
    })

    const full = await call<{ auth: string }>('get.request', {
      collection_external_key: 'c', external_key: 'r',
    })
    const auth = JSON.parse(full.auth)
    expect(auth.bearer_token).toBe(REDACTED)
    expect(full.auth).not.toContain('PLAINTEXT-secret-987')
    expect(JSON.stringify(full)).not.toContain('PLAINTEXT-secret-987')
  })

  it('get.collection masks oauth2 secrets', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    collectionsRepo.update(col.id, {
      auth: JSON.stringify({
        type: 'oauth2',
        oauth2_client_secret: 'CLIENT-SECRET-xyz',
        oauth2_access_token: 'ACCESS-TOK-abc',
        oauth2_refresh_token: 'REFRESH-TOK-def',
      }),
    })

    const result = await call<{ auth: string }>('get.collection', { external_key: 'c' })
    const auth = JSON.parse(result.auth)
    expect(auth.oauth2_client_secret).toBe(REDACTED)
    expect(auth.oauth2_access_token).toBe(REDACTED)
    expect(auth.oauth2_refresh_token).toBe(REDACTED)
    expect(result.auth).not.toContain('CLIENT-SECRET')
    expect(result.auth).not.toContain('ACCESS-TOK')
    expect(result.auth).not.toContain('REFRESH-TOK')
  })

  it('get.folder masks api_key_value and basic_password', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    foldersRepo.create({ collection_id: col.id, name: 'F', external_key: 'f' })
    const folderId = foldersRepo.findByExternalKey(col.id, 'f')!.id
    foldersRepo.update(folderId, {
      auth: JSON.stringify({
        type: 'basic', basic_username: 'admin', basic_password: 'TOPSECRET-pw',
      }),
    })

    const result = await call<{ auth: string }>('get.folder', {
      collection_external_key: 'c', external_key: 'f',
    })
    const auth = JSON.parse(result.auth)
    expect(auth.basic_password).toBe(REDACTED)
    expect(auth.basic_username).toBe(REDACTED)
    expect(result.auth).not.toContain('TOPSECRET-pw')
  })

  it('get.env masks every variable value but keeps keys visible', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    environmentsRepo.create({
      workspace_id: ws.id, name: 'prod', external_key: 'prod',
      variables: JSON.stringify([
        { key: 'API_KEY', value: 'SECRET-12345', enabled: true },
        { key: 'BASE_URL', value: 'https://api.example.com', enabled: true },
        { key: 'EMPTY', value: '', enabled: false },
      ]),
    })

    const result = await call<{ variables: string }>('get.env', { external_key: 'prod' })
    const vars = JSON.parse(result.variables) as Array<{ key: string; value: string }>
    const api = vars.find((v) => v.key === 'API_KEY')!
    const base = vars.find((v) => v.key === 'BASE_URL')!
    const empty = vars.find((v) => v.key === 'EMPTY')!
    expect(api.value).toBe(REDACTED)
    expect(base.value).toBe(REDACTED) // even non-secret-looking URLs are masked
    expect(empty.value).toBe('') // empty preserved so agent sees "configured but blank"
    expect(api.key).toBe('API_KEY')
    expect(base.key).toBe('BASE_URL')
    expect(result.variables).not.toContain('SECRET-12345')
    expect(result.variables).not.toContain('https://api.example.com')
  })

  it('preserves empty/null sensitive fields (so agents can tell configured vs unset)', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    const col = collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    requestsRepo.create({
      collection_id: col.id, name: 'R', external_key: 'r',
      auth: JSON.stringify({ type: 'bearer' }), // no bearer_token field at all
    })

    const result = await call<{ auth: string }>('get.request', {
      collection_external_key: 'c', external_key: 'r',
    })
    const auth = JSON.parse(result.auth)
    expect(auth.bearer_token).toBeUndefined()
  })
})

describe('not-found errors', () => {
  it('get.request returns -32002 when the key is unknown', async () => {
    const ws = workspacesRepo.create({ name: 'WS' })
    collectionsRepo.create({ name: 'C', workspace_id: ws.id, external_key: 'c' })
    const reply = await dispatch({
      jsonrpc: '2.0', id: 1, method: 'get.request', auth: TOKEN,
      params: { collection_external_key: 'c', external_key: 'missing' },
    })
    expect('error' in reply).toBe(true)
    if ('error' in reply) expect(reply.error.code).toBe(-32002)
  })
})
