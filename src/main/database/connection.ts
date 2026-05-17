/**
 * Database connection and migration runner.
 *
 * Uses better-sqlite3 (drop-in compatible with @journeyapps/sqlcipher).
 * Runs numbered migrations on every app launch.
 */

import Database from 'better-sqlite3'
import type { MigrationFile } from './migrations/types'
import m001 from './migrations/001_initial_schema'
import m002 from './migrations/002_mcp_servers'
import m003 from './migrations/003_mcp_sync_fields'
import m004 from './migrations/004_websocket'
import m005 from './migrations/005_indexes_and_constraints'
import m006 from './migrations/006_collection_folder_auth'
import m007 from './migrations/007_collection_folder_scripts'
import m008 from './migrations/008_environment_parent'
import m009 from './migrations/009_external_keys'

let db: Database.Database | null = null

// Static migration registry. Add new migrations here.
const ALL_MIGRATIONS: MigrationFile[] = [m001, m002, m003, m004, m005, m006, m007, m008, m009]

/**
 * Open or create the database. Runs all pending migrations.
 * @param dbPath - Path to the database file.
 * @param pragmaKey - Hex key for SQLCipher PRAGMA (unused with better-sqlite3, ready for sqlcipher swap)
 */
export function openDatabase(dbPath: string, _pragmaKey?: string): Database.Database {
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // When swapping to sqlcipher, uncomment:
  // if (pragmaKey) {
  //   db.pragma(`key = '${pragmaKey}'`)
  // }

  runMigrations(db)

  return db
}

/**
 * Open an in-memory database for testing. No Electron APIs needed.
 */
export function openTestDatabase(): Database.Database {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

/**
 * Get the current database instance.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call openDatabase() first.')
  }
  return db
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Run all pending migrations in order.
 * Uses a `schema_version` table to track which migrations have run.
 */
function runMigrations(database: Database.Database): void {
  // Ensure schema_version table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Get current version
  const row = database.prepare('SELECT MAX(version) as version FROM schema_version').get() as
    | { version: number | null }
    | undefined
  const currentVersion = row?.version ?? 0

  // Run pending migrations
  const pending = ALL_MIGRATIONS.filter((m) => m.version > currentVersion)
  if (pending.length === 0) return

  const applyMigration = database.transaction(() => {
    for (const migration of pending) {
      migration.up(database)
      database
        .prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name)
    }
  })

  applyMigration()
}
