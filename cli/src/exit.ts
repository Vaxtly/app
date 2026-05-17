/** Process exit codes for the CLI. Stable surface — agents/scripts may key off these. */

export const EXIT = {
  OK: 0,
  GENERIC: 1,
  VALIDATION: 2,
  AUTH_FAILED: 3,
  NOT_RUNNING: 4,
  CONFLICT: 5,
} as const

/** Map a JSON-RPC error code to a CLI exit code. */
export function exitCodeForError(rpcCode: number): number {
  switch (rpcCode) {
    case -32001: return EXIT.AUTH_FAILED
    case -32002: return EXIT.VALIDATION  // NOT_FOUND treated as validation (caller passed unknown key)
    case -32003: return EXIT.VALIDATION
    case -32004: return EXIT.CONFLICT
    default: return EXIT.GENERIC
  }
}
