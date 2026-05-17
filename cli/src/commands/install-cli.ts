/**
 * One-shot installer: symlink this CLI's compiled entry into a directory on
 * the user's $PATH so they can invoke `vaxtly` without knowing where the app
 * keeps the bundle. POSIX-only in MVP — Windows shim is Phase 7.
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { EXIT } from '../exit'

export function runInstallCli(): void {
  if (process.platform === 'win32') {
    process.stderr.write('install-cli is not yet supported on Windows.\n')
    process.exit(EXIT.GENERIC)
  }

  const entry = resolve(process.argv[1] ?? '')
  if (!entry || !existsSync(entry)) {
    process.stderr.write('Could not determine the CLI entrypoint. Are you running the bundled binary?\n')
    process.exit(EXIT.GENERIC)
  }

  const targetDir = join(homedir(), '.local', 'bin')
  const target = join(targetDir, 'vaxtly')

  mkdirSync(targetDir, { recursive: true })

  // If an old symlink points elsewhere, replace it; if a real file is there, refuse.
  if (existsSync(target)) {
    try {
      const link = readlinkSync(target)
      // It's a symlink — safe to replace.
      void link
      unlinkSync(target)
    } catch {
      // Not a symlink — could be a real file. Refuse to clobber.
      try {
        const st = statSync(target)
        if (st.isFile()) {
          process.stderr.write(`Refusing to overwrite existing file at ${target}. Remove it first.\n`)
          process.exit(EXIT.GENERIC)
        }
      } catch {
        // ignore
      }
    }
  }

  symlinkSync(entry, target)
  process.stdout.write(JSON.stringify({ installed: target, points_to: entry }) + '\n')

  if (!process.env.PATH?.split(':').includes(targetDir)) {
    process.stderr.write(
      `\nNote: ${targetDir} is not on your $PATH. Add this line to your shell rc:\n` +
        `  export PATH="${targetDir}:$PATH"\n`,
    )
  }

  // Hint where to look if the user's shell uses a different rc.
  void dirname
}
