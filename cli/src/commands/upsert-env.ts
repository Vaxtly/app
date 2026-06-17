import { loadConfig } from '../config'
import { rpc } from '../client'
import {
  getString,
  getStringMaybeEmpty,
  getStrings,
  type ParsedArgs,
} from '../argparse'
import { EXIT } from '../exit'

interface EnvVar {
  key: string
  value: string
  enabled: boolean
}

function parseVar(raw: string): EnvVar {
  const idx = raw.indexOf('=')
  if (idx === -1) {
    process.stderr.write(`Invalid --var (expected "key=value"): ${raw}\n`)
    process.exit(EXIT.VALIDATION)
  }
  return { key: raw.slice(0, idx), value: raw.slice(idx + 1), enabled: true }
}

export async function runUpsertEnv(args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const id = getString(args, 'id')
  if (id !== undefined) params.id = id
  const externalKey = getString(args, 'external-key')
  if (externalKey) params.external_key = externalKey
  const name = getString(args, 'name')
  if (name !== undefined) params.name = name

  const parent = getStringMaybeEmpty(args, 'parent-external-key')
  if (parent !== undefined) params.parent_external_key = parent

  const varInputs = getStrings(args, 'var')
  if (varInputs.length > 0) params.variables = varInputs.map(parseVar)

  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  const result = await rpc(loadConfig(), 'upsert.env', params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
