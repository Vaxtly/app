/**
 * Liveness check. Returns "pong" and the current app version. Useful for
 * the CLI to confirm it found a running Vaxtly and that auth is correct.
 */

import { app } from 'electron'
import { registerMethod } from '../router'

export function registerPing(): void {
  registerMethod('ping', () => {
    let version = 'dev'
    try {
      version = app.getVersion()
    } catch {
      // app may be unavailable in some test harnesses
    }
    return { pong: true, app_version: version }
  })
}
