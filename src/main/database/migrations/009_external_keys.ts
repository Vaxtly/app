/**
 * Add external_key column to collections, folders, requests, and environments.
 *
 * Used by the local agent-socket surface to give external callers (CLI, MCP) a
 * stable, idempotent handle on an entity they own — so re-running an upsert
 * with the same key updates the existing row instead of creating a duplicate.
 *
 * Uniqueness is enforced per immediate parent scope via partial unique indexes
 * (NULL external_keys are unrestricted). Index scoping is deliberately permissive
 * for movable entities:
 *   - requests: scoped to collection_id (not folder_id) so requests can move
 *     between folders without breaking idempotency.
 *   - environments: scoped to workspace_id (not parent_id) for the same reason.
 */

import type Database from 'better-sqlite3'
import type { MigrationFile } from './types'

const SQL = `
  ALTER TABLE collections ADD COLUMN external_key TEXT;
  CREATE UNIQUE INDEX idx_collections_external_key
    ON collections(workspace_id, external_key)
    WHERE external_key IS NOT NULL;

  ALTER TABLE folders ADD COLUMN external_key TEXT;
  CREATE UNIQUE INDEX idx_folders_external_key
    ON folders(collection_id, external_key)
    WHERE external_key IS NOT NULL;

  ALTER TABLE requests ADD COLUMN external_key TEXT;
  CREATE UNIQUE INDEX idx_requests_external_key
    ON requests(collection_id, external_key)
    WHERE external_key IS NOT NULL;

  ALTER TABLE environments ADD COLUMN external_key TEXT;
  CREATE UNIQUE INDEX idx_environments_external_key
    ON environments(workspace_id, external_key)
    WHERE external_key IS NOT NULL;
`

const migration: MigrationFile = {
  version: 9,
  name: '009_external_keys',

  up(db: Database.Database): void {
    db.exec(SQL)
  },
}

export default migration
