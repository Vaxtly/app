import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openTestDatabase, closeDatabase } from '../../src/main/database/connection'
import { initEncryptionForTesting } from '../../src/main/services/encryption'
import * as collectionsRepo from '../../src/main/database/repositories/collections'
import * as foldersRepo from '../../src/main/database/repositories/folders'
import * as requestsRepo from '../../src/main/database/repositories/requests'
import { exportPostman } from '../../src/main/services/postman-export'

beforeEach(() => {
  openTestDatabase()
  initEncryptionForTesting()
})
afterEach(() => closeDatabase())

describe('exportPostman', () => {
  it('generates a valid Postman v2.1 collection envelope', () => {
    const col = collectionsRepo.create({ name: 'My API', description: 'A test API' })
    requestsRepo.create({ collection_id: col.id, name: 'Health', method: 'GET', url: 'https://api.example.com/health' })

    const doc = exportPostman(col.id) as any

    expect(doc.info.name).toBe('My API')
    expect(doc.info.description).toBe('A test API')
    expect(doc.info.schema).toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json')
    expect(typeof doc.info._postman_id).toBe('string')
    expect(doc.info._postman_id.length).toBeGreaterThan(0)
    expect(Array.isArray(doc.item)).toBe(true)
  })

  it('maps requests with method, headers, and url', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'List Users', method: 'GET', url: 'https://api.example.com/users' })
    requestsRepo.update(req.id, {
      headers: JSON.stringify([{ key: 'X-Trace', value: '1', enabled: true }]),
      query_params: JSON.stringify([{ key: 'page', value: '2', enabled: true }]),
    })

    const doc = exportPostman(col.id) as any
    const item = doc.item[0]

    expect(item.name).toBe('List Users')
    expect(item.request.method).toBe('GET')
    expect(item.request.header).toEqual([{ key: 'X-Trace', value: '1' }])
    expect(item.request.url.raw).toBe('https://api.example.com/users?page=2')
    expect(item.request.url.query).toEqual([{ key: 'page', value: '2' }])
  })

  it('marks disabled headers and query params', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'R', method: 'GET', url: 'https://x.test/a' })
    requestsRepo.update(req.id, {
      headers: JSON.stringify([{ key: 'X-Off', value: 'v', enabled: false }]),
      query_params: JSON.stringify([{ key: 'q', value: 'v', enabled: false }]),
    })

    const doc = exportPostman(col.id) as any
    const request = doc.item[0].request

    expect(request.header[0].disabled).toBe(true)
    expect(request.url.query[0].disabled).toBe(true)
    // Disabled param is excluded from raw URL.
    expect(request.url.raw).toBe('https://x.test/a')
  })

  it('nests folders as item groups', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const parent = foldersRepo.create({ collection_id: col.id, name: 'Users' })
    const child = foldersRepo.create({ collection_id: col.id, name: 'Admin', parent_id: parent.id })
    requestsRepo.create({ collection_id: col.id, folder_id: child.id, name: 'Ban', method: 'POST', url: 'https://x.test/ban' })

    const doc = exportPostman(col.id) as any
    const usersGroup = doc.item.find((i: any) => i.name === 'Users')

    expect(usersGroup).toBeDefined()
    const adminGroup = usersGroup.item.find((i: any) => i.name === 'Admin')
    expect(adminGroup).toBeDefined()
    expect(adminGroup.item[0].name).toBe('Ban')
  })

  it('maps JSON body to raw mode with json language', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'Create', method: 'POST', url: 'https://x.test', body_type: 'json' })
    requestsRepo.update(req.id, { body: '{"a":1}' })

    const doc = exportPostman(col.id) as any
    const body = doc.item[0].request.body

    expect(body.mode).toBe('raw')
    expect(body.raw).toBe('{"a":1}')
    expect(body.options.raw.language).toBe('json')
  })

  it('maps form-data body to formdata entries', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'Upload', method: 'POST', url: 'https://x.test', body_type: 'form-data' })
    requestsRepo.update(req.id, { body: JSON.stringify([{ key: 'name', value: 'bob', enabled: true }]) })

    const doc = exportPostman(col.id) as any
    const body = doc.item[0].request.body

    expect(body.mode).toBe('formdata')
    expect(body.formdata).toEqual([{ key: 'name', value: 'bob', type: 'text' }])
  })

  it('omits body for none body_type', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    requestsRepo.create({ collection_id: col.id, name: 'Get', method: 'GET', url: 'https://x.test', body_type: 'none' })

    const doc = exportPostman(col.id) as any
    expect(doc.item[0].request.body).toBeUndefined()
  })

  it('maps bearer auth', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'Secure', method: 'GET', url: 'https://x.test' })
    requestsRepo.update(req.id, { auth: JSON.stringify({ type: 'bearer', bearer_token: 'abc123' }) })

    const doc = exportPostman(col.id) as any
    const auth = doc.item[0].request.auth

    expect(auth.type).toBe('bearer')
    expect(auth.bearer).toEqual([{ key: 'token', value: 'abc123', type: 'string' }])
  })

  it('omits auth for inherit type', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    const req = requestsRepo.create({ collection_id: col.id, name: 'R', method: 'GET', url: 'https://x.test' })
    requestsRepo.update(req.id, { auth: JSON.stringify({ type: 'inherit' }) })

    const doc = exportPostman(col.id) as any
    expect(doc.item[0].request.auth).toBeUndefined()
  })

  it('exports collection variables', () => {
    const col = collectionsRepo.create({ name: 'Test' })
    collectionsRepo.update(col.id, { variables: JSON.stringify([{ key: 'baseUrl', value: 'https://x.test', enabled: true }]) })
    requestsRepo.create({ collection_id: col.id, name: 'R', method: 'GET', url: '{{baseUrl}}/a' })

    const doc = exportPostman(col.id) as any
    expect(doc.variable).toEqual([{ key: 'baseUrl', value: 'https://x.test' }])
  })

  it('throws for a missing collection', () => {
    expect(() => exportPostman('does-not-exist')).toThrow()
  })
})
