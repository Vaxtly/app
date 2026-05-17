import { loadConfig } from '../config'
import { rpc } from '../client'
import { getString, type ParsedArgs } from '../argparse'

export async function runUpsertCollection(args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const externalKey = getString(args, 'external-key')
  if (externalKey) params.external_key = externalKey
  const name = getString(args, 'name')
  if (name !== undefined) params.name = name
  const description = getString(args, 'description')
  if (description !== undefined) params.description = description
  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  const result = await rpc(loadConfig(), 'upsert.collection', params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
