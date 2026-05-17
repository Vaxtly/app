/**
 * List all workspaces. Workspaces have no external_key — they're identified
 * by UUID. Use this when the agent needs to target a specific workspace.
 */

import * as workspacesRepo from '../../../database/repositories/workspaces'
import { registerMethod } from '../router'

export function registerListWorkspaces(): void {
  registerMethod('list.workspaces', () => {
    return workspacesRepo.findAll().map((w) => ({ id: w.id, name: w.name }))
  })
}
