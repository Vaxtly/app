/**
 * Notify renderer windows that the agent socket (CLI / MCP) mutated data.
 *
 * Reads and the UI's own IPC mutations already keep the renderer in sync; only
 * out-of-band writes coming in over the agent socket are invisible to the
 * renderer's cached stores. After such a write commits, broadcast a lightweight
 * signal so the renderer can reload the affected store live instead of waiting
 * for an app restart.
 *
 * Mirrors the broadcast pattern used by session-log / websocket-client: fan out
 * to every open window via BrowserWindow.getAllWindows() — no window handle to
 * thread through the agent-socket method handlers.
 */

import { BrowserWindow } from 'electron'
import { IPC, type AgentDataChangedEvent } from '../../../shared/types/ipc'

export function notifyAgentDataChanged(event: AgentDataChangedEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.AGENT_DATA_CHANGED, event)
  }
}
