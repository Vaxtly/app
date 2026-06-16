/**
 * Postman Collection v2.1 export — converts a Vaxtly collection into a Postman
 * collection JSON document. Folder hierarchy maps to nested item groups, requests
 * map to request items. Returns the document object (the renderer serializes it).
 *
 * Note: Vaxtly scripts/assertions are not translated to Postman events.
 */

import { v4 as uuid } from 'uuid'
import * as collectionsRepo from '../database/repositories/collections'
import * as foldersRepo from '../database/repositories/folders'
import * as requestsRepo from '../database/repositories/requests'
import type { Folder, Request as Req, KeyValueEntry, AuthConfig } from '../../shared/types/models'

const SCHEMA_URL = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

// --- Postman types (subset we emit) ---

interface PostmanCollection {
  info: {
    _postman_id: string
    name: string
    description?: string
    schema: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
}

interface PostmanItemGroup {
  name: string
  description?: string
  item: PostmanItem[]
  auth?: PostmanAuth
}

interface PostmanRequestItem {
  name: string
  request: PostmanRequest
}

type PostmanItem = PostmanItemGroup | PostmanRequestItem

interface PostmanRequest {
  method: string
  header: PostmanHeader[]
  url: PostmanUrl
  body?: PostmanBody
  auth?: PostmanAuth
}

interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

interface PostmanUrl {
  raw: string
  host?: string[]
  path?: string[]
  query?: { key: string; value: string; disabled?: boolean; description?: string }[]
}

interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'graphql'
  raw?: string
  urlencoded?: { key: string; value: string; disabled?: boolean }[]
  formdata?: { key: string; value: string; type: string; disabled?: boolean }[]
  graphql?: { query: string; variables: string }
  options?: { raw: { language: string } }
}

interface PostmanVariable {
  key: string
  value: string
  disabled?: boolean
}

interface PostmanAuth {
  type: string
  bearer?: { key: string; value: string; type: string }[]
  basic?: { key: string; value: string; type: string }[]
  apikey?: { key: string; value: string; type: string }[]
  oauth2?: { key: string; value: string; type: string }[]
}

// --- Main export ---

export function exportPostman(collectionId: string): PostmanCollection {
  const collection = collectionsRepo.findById(collectionId)
  if (!collection) throw new Error(`Collection not found: ${collectionId}`)

  const allFolders = foldersRepo.findByCollection(collection.id)
  const rootRequests = requestsRepo.findByFolder(null, collection.id)

  const doc: PostmanCollection = {
    info: {
      _postman_id: uuid(),
      name: collection.name,
      schema: SCHEMA_URL,
    },
    item: [
      ...buildFolderItems(collection.id, allFolders, null),
      ...rootRequests.map(buildRequestItem),
    ],
  }

  if (collection.description) doc.info.description = collection.description

  const variables = collection.variables ? safeJsonParse<KeyValueEntry[]>(collection.variables) : null
  if (variables && variables.length > 0) doc.variable = variables.map(toPostmanVariable)

  const auth = collection.auth ? safeJsonParse<AuthConfig>(collection.auth) : null
  const collAuth = auth ? buildAuth(auth) : null
  if (collAuth) doc.auth = collAuth

  return doc
}

// --- Tree building ---

function buildFolderItems(collectionId: string, allFolders: Folder[], parentId: string | null): PostmanItemGroup[] {
  const children = allFolders.filter((f) => (parentId ? f.parent_id === parentId : !f.parent_id))

  return children.map((folder) => {
    const requests = requestsRepo.findByFolder(folder.id, collectionId)
    const group: PostmanItemGroup = {
      name: folder.name,
      item: [
        ...buildFolderItems(collectionId, allFolders, folder.id),
        ...requests.map(buildRequestItem),
      ],
    }

    const auth = folder.auth ? safeJsonParse<AuthConfig>(folder.auth) : null
    const folderAuth = auth ? buildAuth(auth) : null
    if (folderAuth) group.auth = folderAuth

    return group
  })
}

function buildRequestItem(request: Req): PostmanRequestItem {
  const req: PostmanRequest = {
    method: request.method,
    header: buildHeaders(request),
    url: buildUrl(request),
  }

  const body = buildBody(request)
  if (body) req.body = body

  const auth = request.auth ? safeJsonParse<AuthConfig>(request.auth) : null
  const reqAuth = auth ? buildAuth(auth) : null
  if (reqAuth) req.auth = reqAuth

  return { name: request.name, request: req }
}

// --- Field mappers ---

function buildHeaders(request: Req): PostmanHeader[] {
  const headers = request.headers ? safeJsonParse<KeyValueEntry[]>(request.headers) : null
  if (!headers) return []

  return headers.map((h) => {
    const header: PostmanHeader = { key: h.key, value: h.value }
    if (!h.enabled) header.disabled = true
    if (h.description) header.description = h.description
    return header
  })
}

function buildUrl(request: Req): PostmanUrl {
  // Strip any existing query string; we represent params via the query array.
  const base = request.url.split('?')[0]
  const params = request.query_params ? safeJsonParse<KeyValueEntry[]>(request.query_params) : null

  const query = params?.map((p) => {
    const entry: { key: string; value: string; disabled?: boolean; description?: string } = {
      key: p.key,
      value: p.value,
    }
    if (!p.enabled) entry.disabled = true
    if (p.description) entry.description = p.description
    return entry
  })

  const enabled = (query ?? []).filter((q) => !q.disabled)
  const raw = enabled.length > 0
    ? `${base}?${enabled.map((q) => `${q.key}=${q.value}`).join('&')}`
    : base

  const url: PostmanUrl = { raw }
  if (query && query.length > 0) url.query = query
  return url
}

function buildBody(request: Req): PostmanBody | null {
  if (request.body_type === 'none' || !request.body) return null

  switch (request.body_type) {
    case 'json':
      return { mode: 'raw', raw: request.body, options: { raw: { language: 'json' } } }
    case 'xml':
      return { mode: 'raw', raw: request.body, options: { raw: { language: 'xml' } } }
    case 'raw':
      return { mode: 'raw', raw: request.body, options: { raw: { language: 'text' } } }
    case 'graphql': {
      const parsed = safeJsonParse<{ query?: string; variables?: unknown }>(request.body)
      return {
        mode: 'graphql',
        graphql: {
          query: parsed?.query ?? '',
          variables: typeof parsed?.variables === 'string'
            ? parsed.variables
            : JSON.stringify(parsed?.variables ?? {}),
        },
      }
    }
    case 'urlencoded': {
      const entries = safeJsonParse<KeyValueEntry[]>(request.body) ?? []
      return {
        mode: 'urlencoded',
        urlencoded: entries.map((e) => {
          const item: { key: string; value: string; disabled?: boolean } = { key: e.key, value: e.value }
          if (!e.enabled) item.disabled = true
          return item
        }),
      }
    }
    case 'form-data': {
      const entries = safeJsonParse<KeyValueEntry[]>(request.body) ?? []
      return {
        mode: 'formdata',
        formdata: entries.map((e) => {
          const item: { key: string; value: string; type: string; disabled?: boolean } = {
            key: e.key,
            value: e.value,
            type: 'text',
          }
          if (!e.enabled) item.disabled = true
          return item
        }),
      }
    }
    default:
      return { mode: 'raw', raw: request.body }
  }
}

/** Map a Vaxtly AuthConfig to a Postman auth block. Returns null to inherit from parent. */
function buildAuth(auth: AuthConfig): PostmanAuth | null {
  switch (auth.type) {
    case 'none':
      return { type: 'noauth' }
    case 'bearer':
      return { type: 'bearer', bearer: [{ key: 'token', value: auth.bearer_token ?? '', type: 'string' }] }
    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: auth.basic_username ?? '', type: 'string' },
          { key: 'password', value: auth.basic_password ?? '', type: 'string' },
        ],
      }
    case 'api-key':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: auth.api_key_header ?? '', type: 'string' },
          { key: 'value', value: auth.api_key_value ?? '', type: 'string' },
          { key: 'in', value: 'header', type: 'string' },
        ],
      }
    case 'oauth2': {
      const fields: { key: string; value: string; type: string }[] = []
      const push = (key: string, value: string | undefined): void => {
        if (value) fields.push({ key, value, type: 'string' })
      }
      push('accessToken', auth.oauth2_access_token)
      push('tokenType', auth.oauth2_token_type)
      push('grant_type', auth.oauth2_grant_type)
      push('accessTokenUrl', auth.oauth2_access_token_url)
      push('authUrl', auth.oauth2_authorization_url)
      push('clientId', auth.oauth2_client_id)
      push('clientSecret', auth.oauth2_client_secret)
      push('scope', auth.oauth2_scope)
      push('redirect_uri', auth.oauth2_redirect_url)
      return { type: 'oauth2', oauth2: fields }
    }
    // 'inherit' (and anything unknown) — let Postman inherit from the parent.
    default:
      return null
  }
}

function toPostmanVariable(v: KeyValueEntry): PostmanVariable {
  const variable: PostmanVariable = { key: v.key, value: v.value }
  if (!v.enabled) variable.disabled = true
  return variable
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
