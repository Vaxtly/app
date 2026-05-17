/**
 * Environment mutations. Thin wrapper over the repository so that the
 * agent-socket and IPC surfaces share a single mutation entry point.
 */

import * as environmentsRepo from '../database/repositories/environments'
import type { Environment } from '../../shared/types/models'

export function createEnvironment(data: {
  name: string
  workspace_id?: string
  parent_id?: string | null
  variables?: string
  external_key?: string | null
}): Environment {
  return environmentsRepo.create(data)
}

export function updateEnvironment(
  id: string,
  data: Partial<Omit<Environment, 'id' | 'created_at'>>,
): Environment | undefined {
  return environmentsRepo.update(id, data)
}
