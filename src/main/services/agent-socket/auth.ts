/**
 * Per-session bearer token for the agent socket.
 *
 * The token is generated on app launch, held in memory, and written to a
 * 0600-permissioned dotfile at `~/.vaxtly/cli.json`. The CLI reads the dotfile
 * to discover (a) the socket path and (b) the token to include in every
 * JSON-RPC request. The token is rotated on every launch — previous instances
 * are invalidated.
 *
 * On non-Windows we rely on file permissions for confidentiality. On Windows
 * the `%USERPROFILE%\.vaxtly\cli.json` lives in the user's profile, but the
 * primary defense remains the named-pipe ACL bound to the current user.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface DotfileContents {
  socket_path: string
  token: string
  pid: number
  app_version: string
}

let currentToken: Buffer | null = null
let dotfilePath: string | null = null

export function configDir(): string {
  // Allow test isolation: VAXTLY_TEST_CLI_CONFIG_DIR overrides ~/.vaxtly entirely
  return process.env.VAXTLY_TEST_CLI_CONFIG_DIR ?? join(homedir(), '.vaxtly')
}

export function dotfileLocation(): string {
  return join(configDir(), 'cli.json')
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function writeDotfile(contents: DotfileContents): void {
  const dir = configDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  const path = join(dir, 'cli.json')
  // Write atomically: 0600 is set on creation via the mode option,
  // but Node sometimes ignores it on existing files — chmod to be safe.
  writeFileSync(path, JSON.stringify(contents, null, 2), { mode: 0o600 })
  try {
    chmodSync(path, 0o600)
  } catch {
    // best-effort; Windows in particular ignores POSIX modes
  }
  dotfilePath = path
}

export function removeDotfile(): void {
  if (dotfilePath && existsSync(dotfilePath)) {
    try {
      rmSync(dotfilePath)
    } catch {
      // best-effort cleanup
    }
  }
  dotfilePath = null
  currentToken = null
}

export function setCurrentToken(token: string): void {
  currentToken = Buffer.from(token, 'utf8')
}

/**
 * Constant-time comparison against the in-memory token. Returns false on any
 * mismatch (including empty/missing input) and never throws.
 */
export function verifyToken(presented: unknown): boolean {
  if (typeof presented !== 'string' || presented.length === 0) return false
  if (!currentToken) return false
  const provided = Buffer.from(presented, 'utf8')
  if (provided.length !== currentToken.length) return false
  return timingSafeEqual(provided, currentToken)
}
