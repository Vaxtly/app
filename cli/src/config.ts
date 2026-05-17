/**
 * Locate and read the dotfile written by a running Vaxtly app. Exits with
 * status 4 if the file is missing — meaning Vaxtly isn't running (the app
 * removes the dotfile on shutdown).
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { EXIT } from './exit'

export interface CliConfig {
  socket_path: string
  token: string
  pid: number
  app_version: string
}

export function configDir(): string {
  return process.env.VAXTLY_TEST_CLI_CONFIG_DIR ?? join(homedir(), '.vaxtly')
}

export function loadConfig(): CliConfig {
  const path = join(configDir(), 'cli.json')
  if (!existsSync(path)) {
    process.stderr.write('Vaxtly is not running. Start the app and try again.\n')
    process.exit(EXIT.NOT_RUNNING)
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as CliConfig
  } catch (err) {
    process.stderr.write(`Failed to read ${path}: ${(err as Error).message}\n`)
    process.exit(EXIT.GENERIC)
  }
}
