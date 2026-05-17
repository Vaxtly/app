import { loadConfig } from '../config'
import { rpc } from '../client'
import {
  getString,
  getStringMaybeEmpty,
  type ParsedArgs,
} from '../argparse'
import { EXIT } from '../exit'

export async function runList(sub: string, args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId

  let method: string
  switch (sub) {
    case 'workspaces':
      method = 'list.workspaces'
      break
    case 'collections':
      method = 'list.collections'
      break
    case 'folders': {
      method = 'list.folders'
      const ck = getString(args, 'collection-external-key')
      if (ck) params.collection_external_key = ck
      break
    }
    case 'requests': {
      method = 'list.requests'
      const ck = getString(args, 'collection-external-key')
      if (ck) params.collection_external_key = ck
      const fk = getStringMaybeEmpty(args, 'folder-external-key')
      if (fk !== undefined) params.folder_external_key = fk
      break
    }
    case 'envs':
      method = 'list.envs'
      break
    default:
      process.stderr.write(`Unknown list subcommand: ${sub}\n`)
      process.exit(EXIT.VALIDATION)
  }

  const result = await rpc(loadConfig(), method, params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
