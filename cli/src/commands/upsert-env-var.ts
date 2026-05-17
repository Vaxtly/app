import { loadConfig } from '../config'
import { rpc } from '../client'
import { getString, type ParsedArgs } from '../argparse'

export async function runUpsertEnvVar(args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}

  const envKey = getString(args, 'env-external-key')
  if (envKey) params.env_external_key = envKey

  const key = getString(args, 'key')
  if (key) params.key = key

  // Use raw flag map so empty-string `--value ''` is preserved.
  const rawValue = args.flags.get('value')
  if (typeof rawValue === 'string') params.value = rawValue

  // --disabled disables the var (default: enabled).
  if (args.flags.has('disabled')) params.enabled = false

  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  const result = await rpc(loadConfig(), 'upsert.env_variable', params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
