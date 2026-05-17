import { loadConfig } from '../config'
import { rpc } from '../client'
import { getString, getStringMaybeEmpty, type ParsedArgs } from '../argparse'

export async function runUpsertFolder(args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const collectionKey = getString(args, 'collection-external-key')
  if (collectionKey) params.collection_external_key = collectionKey
  const externalKey = getString(args, 'external-key')
  if (externalKey) params.external_key = externalKey
  const name = getString(args, 'name')
  if (name !== undefined) params.name = name

  const parentFolder = getStringMaybeEmpty(args, 'parent-folder-external-key')
  if (parentFolder !== undefined) params.parent_folder_external_key = parentFolder

  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  const result = await rpc(loadConfig(), 'upsert.folder', params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
