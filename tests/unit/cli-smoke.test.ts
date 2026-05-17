/**
 * Smoke tests for the compiled `vaxtly` CLI binary.
 *
 * The CLI's end-to-end behavior against a live agent-socket is covered by
 * `agent-socket-upsert.test.ts` (which tests every method) plus a manual
 * `npm run dev` + `node cli/dist/index.js …` check. Spawning the bundled
 * binary as a subprocess from inside a vitest worker that also hosts the
 * socket server is fragile (Node's `spawnSync` blocks the worker thread,
 * defeating vitest's testTimeout), so we keep these tests to the paths that
 * don't need a live server: argv dispatch, dotfile-missing handling, help.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI_BIN = resolve(__dirname, '..', '..', 'cli', 'dist', 'index.js')

let emptyConfigDir: string

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const out = spawnSync('node', [CLI_BIN, ...args], {
    env: { ...process.env, VAXTLY_TEST_CLI_CONFIG_DIR: emptyConfigDir },
    encoding: 'utf8',
    timeout: 5000,
  })
  return { status: out.status, stdout: out.stdout, stderr: out.stderr }
}

beforeEach(() => {
  emptyConfigDir = mkdtempSync(join(tmpdir(), 'vaxtly-cli-empty-'))
})

afterEach(() => {
  rmSync(emptyConfigDir, { recursive: true, force: true })
})

describe('vaxtly CLI smoke', () => {
  it('the bundle exists (must run `npm run build:cli` first)', () => {
    expect(existsSync(CLI_BIN)).toBe(true)
  })

  it('exits 4 with a clear message when Vaxtly is not running', () => {
    const r = runCli(['ping'])
    expect(r.status).toBe(4)
    expect(r.stderr).toContain('not running')
  })

  it('exits 4 even for upsert verbs when no server is reachable', () => {
    const r = runCli(['upsert', 'collection', '--external-key', 'x', '--name', 'X'])
    expect(r.status).toBe(4)
  })

  it('prints help with no arguments and exit 0', () => {
    const r = runCli([])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Vaxtly CLI')
    expect(r.stdout).toContain('upsert request')
    expect(r.stdout).toContain('vaxtly mcp')
  })

  it('exits 2 on unknown verb', () => {
    const r = runCli(['frobnicate'])
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('Unknown command')
  })

  it('exits 2 on unknown upsert subcommand', () => {
    const r = runCli(['upsert', 'nonsense'])
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('Unknown upsert subcommand')
  })
})
