#!/usr/bin/env node
/**
 * Vaxtly CLI entry. Two modes:
 *   - `vaxtly <verb> [<sub> ...]`  one-shot RPC against the running app.
 *   - `vaxtly mcp`                 stdio MCP server proxying the same RPCs.
 *
 * Exit codes (see src/exit.ts): 0 ok, 1 generic, 2 validation, 3 auth, 4 not
 * running, 5 conflict. Stdout is JSON on success; stderr carries human errors.
 *
 * Help discovery for agents:
 *   vaxtly                         → HELP_TOP (concepts + grammar + example)
 *   vaxtly --help | -h | help      → same as above
 *   vaxtly <verb> --help           → per-verb help with examples
 *   vaxtly <verb> <sub> --help     → per-subcommand help (upsert collection, etc.)
 *   vaxtly guide                   → long-form agent guide (cli/src/guide.ts)
 */

import { parseArgs } from './argparse'
import { runUpsertCollection } from './commands/upsert-collection'
import { runUpsertFolder } from './commands/upsert-folder'
import { runUpsertRequest } from './commands/upsert-request'
import { runUpsertEnv } from './commands/upsert-env'
import { runUpsertEnvVar } from './commands/upsert-env-var'
import { runPing } from './commands/ping'
import { runInstallCli } from './commands/install-cli'
import { runList } from './commands/list'
import { runGet } from './commands/get'
import { RpcError } from './client'
import { EXIT, exitCodeForError } from './exit'
import { HELP_TOP, helpForVerb } from './help'
import { GUIDE } from './guide'

function wantsHelp(args: string[]): boolean {
  return args.some((a) => a === '--help' || a === '-h')
}

function stripHelp(args: string[]): string[] {
  return args.filter((a) => a !== '--help' && a !== '-h')
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2)

  // Top-level help: no args, --help/-h alone, or `vaxtly help` with no verb.
  if (argv.length === 0 || (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help'))) {
    process.stdout.write(HELP_TOP)
    return
  }

  // `vaxtly help <verb> [<sub>]` — alias for `vaxtly <verb> [<sub>] --help`.
  if (argv[0] === 'help') {
    const verb = argv[1]
    const sub = argv[2]
    const text = verb ? helpForVerb(verb, sub) : undefined
    if (text) {
      process.stdout.write(text)
      return
    }
    process.stderr.write(`No help available for: ${argv.slice(1).join(' ')}\nRun \`vaxtly --help\`.\n`)
    process.exit(EXIT.VALIDATION)
  }

  if (argv[0] === 'guide') {
    process.stdout.write(GUIDE)
    return
  }

  const [verb, ...rest] = argv

  // `vaxtly <verb> --help` and `vaxtly <verb> <sub> --help` — print per-verb help.
  if (wantsHelp(rest)) {
    const sub = rest.find((a) => !a.startsWith('--') && a !== '-h')
    const text = helpForVerb(verb, sub)
    if (text) {
      process.stdout.write(text)
      return
    }
  }

  if (verb === 'ping') {
    return runPing()
  }
  if (verb === 'install-cli') {
    return runInstallCli()
  }
  if (verb === 'mcp') {
    const { runMcp } = await import('./mcp/server')
    return runMcp()
  }
  if (verb === 'list') {
    const [sub, ...flagArgs] = stripHelp(rest)
    if (!sub) {
      process.stderr.write('Missing list subcommand. Run `vaxtly list --help`.\n')
      process.exit(EXIT.VALIDATION)
    }
    return runList(sub, parseArgs(flagArgs))
  }

  if (verb === 'get') {
    const [sub, ...flagArgs] = stripHelp(rest)
    if (!sub) {
      process.stderr.write('Missing get subcommand. Run `vaxtly get --help`.\n')
      process.exit(EXIT.VALIDATION)
    }
    return runGet(sub, parseArgs(flagArgs))
  }

  if (verb !== 'upsert') {
    process.stderr.write(`Unknown command: ${verb}\nRun \`vaxtly --help\` for usage.\n`)
    process.exit(EXIT.VALIDATION)
  }

  const [sub, ...flagArgs] = stripHelp(rest)
  const parsed = parseArgs(flagArgs)
  switch (sub) {
    case 'collection': return runUpsertCollection(parsed)
    case 'folder':     return runUpsertFolder(parsed)
    case 'request':    return runUpsertRequest(parsed)
    case 'env':        return runUpsertEnv(parsed)
    case 'env-var':    return runUpsertEnvVar(parsed)
    default:
      process.stderr.write(`Unknown upsert subcommand: ${sub}\nRun \`vaxtly upsert --help\` for usage.\n`)
      process.exit(EXIT.VALIDATION)
  }
}

run().catch((err) => {
  if (err instanceof RpcError) {
    process.stderr.write(`${err.message}\n`)
    process.exit(exitCodeForError(err.code))
  }
  if (err instanceof Error) {
    process.stderr.write(`${err.message}\n`)
  }
  process.exit(EXIT.GENERIC)
})
