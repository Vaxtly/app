/**
 * List collections in a workspace, slimmed to the fields an agent needs to
 * navigate (no auth, no scripts, no remote sync metadata).
 */

import * as collectionsRepo from '../../../database/repositories/collections'
import { registerMethod } from '../router'
import { resolveWorkspaceId } from './_resolvers'

export function registerListCollections(): void {
  registerMethod('list.collections', (params) => {
    const workspaceId = resolveWorkspaceId(params.workspace_id)
    return collectionsRepo.findByWorkspace(workspaceId).map((c) => ({
      id: c.id,
      external_key: c.external_key,
      name: c.name,
      description: c.description,
    }))
  })
}
