import { readFileSync } from 'node:fs'
import { loadConfig } from '../config'
import { rpc } from '../client'
import {
  getString,
  getStringMaybeEmpty,
  getStrings,
  type ParsedArgs,
} from '../argparse'
import { EXIT } from '../exit'

interface KeyValueEntry {
  key: string
  value: string
  enabled: boolean
}

function parseKeyValueList(values: string[], flagName: string, sep: string): KeyValueEntry[] {
  return values.map((raw) => {
    const idx = raw.indexOf(sep)
    if (idx === -1) {
      process.stderr.write(`Invalid ${flagName} (expected "key${sep}value"): ${raw}\n`)
      process.exit(EXIT.VALIDATION)
    }
    return {
      key: raw.slice(0, idx).trim(),
      value: raw.slice(idx + sep.length).trim(),
      enabled: true,
    }
  })
}

function readBody(flag: string | undefined): string | undefined {
  if (flag === undefined) return undefined
  if (flag.startsWith('@')) {
    const path = flag.slice(1)
    return readFileSync(path, 'utf8')
  }
  return flag
}

interface AuthConfig {
  type: 'none' | 'inherit' | 'bearer' | 'basic' | 'api-key'
  bearer_token?: string
  basic_username?: string
  basic_password?: string
  api_key_header?: string
  api_key_value?: string
}

function assembleAuth(args: ParsedArgs): AuthConfig | undefined {
  const type = getString(args, 'auth-type')
  if (!type) return undefined
  switch (type) {
    case 'none':
    case 'inherit':
      return { type }
    case 'bearer': {
      const token = getString(args, 'bearer-token')
      if (!token) {
        process.stderr.write('--bearer-token is required when --auth-type bearer\n')
        process.exit(EXIT.VALIDATION)
      }
      return { type: 'bearer', bearer_token: token }
    }
    case 'basic': {
      const u = getString(args, 'basic-username')
      const p = getString(args, 'basic-password')
      if (!u || !p) {
        process.stderr.write('--basic-username and --basic-password are required when --auth-type basic\n')
        process.exit(EXIT.VALIDATION)
      }
      return { type: 'basic', basic_username: u, basic_password: p }
    }
    case 'api-key': {
      const name = getString(args, 'api-key-name')
      const value = getString(args, 'api-key-value')
      if (!name || !value) {
        process.stderr.write('--api-key-name and --api-key-value are required when --auth-type api-key\n')
        process.exit(EXIT.VALIDATION)
      }
      return { type: 'api-key', api_key_header: name, api_key_value: value }
    }
    default:
      process.stderr.write(`Unsupported --auth-type ${type}\n`)
      process.exit(EXIT.VALIDATION)
  }
}

export async function runUpsertRequest(args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const id = getString(args, 'id')
  if (id !== undefined) params.id = id
  const collectionKey = getString(args, 'collection-external-key')
  if (collectionKey) params.collection_external_key = collectionKey
  const externalKey = getString(args, 'external-key')
  if (externalKey) params.external_key = externalKey
  const name = getString(args, 'name')
  if (name !== undefined) params.name = name
  const method = getString(args, 'method')
  if (method !== undefined) params.method = method
  const url = getString(args, 'url')
  if (url !== undefined) params.url = url
  const bodyType = getString(args, 'body-type')
  if (bodyType !== undefined) params.body_type = bodyType

  const body = readBody(getString(args, 'body'))
  if (body !== undefined) params.body = body

  const headerInputs = getStrings(args, 'header')
  if (headerInputs.length > 0) params.headers = parseKeyValueList(headerInputs, '--header', ':')
  const queryInputs = getStrings(args, 'query')
  if (queryInputs.length > 0) params.query_params = parseKeyValueList(queryInputs, '--query', '=')

  const folderKey = getStringMaybeEmpty(args, 'folder-external-key')
  if (folderKey !== undefined) params.folder_external_key = folderKey

  const auth = assembleAuth(args)
  if (auth !== undefined) params.auth = auth

  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  const result = await rpc(loadConfig(), 'upsert.request', params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
