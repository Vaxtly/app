/**
 * Tiny hand-rolled long-flag parser. Supports:
 *   --flag value          → single value
 *   --flag=value          → single value
 *   --boolean             → true (if no value follows or next arg starts with --)
 *   --header X --header Y → repeated values
 *
 * Returns a Map<string, string | true | string[]>. Order is preserved for
 * repeated flags so headers/query params line up with input order.
 */

export type FlagValue = string | true | string[]

export interface ParsedArgs {
  positional: string[]
  flags: Map<string, FlagValue>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags = new Map<string, FlagValue>()

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (!tok.startsWith('--')) {
      positional.push(tok)
      continue
    }

    let name: string
    let value: string | undefined
    const eq = tok.indexOf('=')
    if (eq !== -1) {
      name = tok.slice(2, eq)
      value = tok.slice(eq + 1)
    } else {
      name = tok.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        value = next
        i++
      }
    }

    const existing = flags.get(name)
    if (value === undefined) {
      flags.set(name, true)
    } else if (existing === undefined) {
      flags.set(name, value)
    } else if (typeof existing === 'string') {
      flags.set(name, [existing, value])
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      // existing was `true` (boolean) — coerce to array
      flags.set(name, [String(existing), value])
    }
  }

  return { positional, flags }
}

export function getString(args: ParsedArgs, name: string): string | undefined {
  const v = args.flags.get(name)
  if (typeof v === 'string') return v
  return undefined
}

export function getStringMaybeEmpty(args: ParsedArgs, name: string): string | null | undefined {
  // Three-state: undefined (not provided), null (provided as ''), or a string.
  if (!args.flags.has(name)) return undefined
  const v = args.flags.get(name)
  if (v === '') return null
  if (typeof v === 'string') return v
  return undefined
}

export function getStrings(args: ParsedArgs, name: string): string[] {
  const v = args.flags.get(name)
  if (Array.isArray(v)) return v
  if (typeof v === 'string') return [v]
  return []
}

export function getBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags.get(name) === true
}
