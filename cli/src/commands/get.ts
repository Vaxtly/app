import { loadConfig } from '../config'
import { rpc } from '../client'
import { getString, type ParsedArgs } from '../argparse'
import { EXIT } from '../exit'

export async function runGet(sub: string, args: ParsedArgs): Promise<void> {
  const params: Record<string, unknown> = {}
  const workspaceId = getString(args, 'workspace-id')
  if (workspaceId !== undefined) params.workspace_id = workspaceId
  const externalKey = getString(args, 'external-key')
  if (externalKey !== undefined) params.external_key = externalKey

  let method: string
  switch (sub) {
    case 'collection':
      method = 'get.collection'
      break
    case 'folder': {
      method = 'get.folder'
      const ck = getString(args, 'collection-external-key')
      if (ck) params.collection_external_key = ck
      break
    }
    case 'request': {
      method = 'get.request'
      const ck = getString(args, 'collection-external-key')
      if (ck) params.collection_external_key = ck
      break
    }
    case 'env':
      method = 'get.env'
      break
    default:
      process.stderr.write(`Unknown get subcommand: ${sub}\n`)
      process.exit(EXIT.VALIDATION)
  }

  const result = await rpc(loadConfig(), method, params)
  process.stdout.write(JSON.stringify(result) + '\n')
}
