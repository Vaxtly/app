import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import { IPC } from '../../shared/types/ipc'
import * as dataService from '../services/data-export-import'
import { exportOpenAPI } from '../services/openapi-export'
import { exportPostman } from '../services/postman-export'
import { importPostman } from '../services/postman-import'
import { importInsomnia } from '../services/insomnia-import'
import { importOpenAPI } from '../services/openapi-import'
import type { OpenAPIImportResult } from '../services/openapi-import'

const MAX_IMPORT_SIZE = 50 * 1024 * 1024 // 50 MB

export function registerDataImportExportHandlers(): void {
  ipcMain.handle(
    IPC.DATA_EXPORT,
    async (_event, type: 'all' | 'collections' | 'environments' | 'mcp_servers' | 'config', workspaceId?: string) => {
      switch (type) {
        case 'all':
          return dataService.exportAll(workspaceId)
        case 'collections':
          return dataService.exportCollections(workspaceId)
        case 'environments':
          return dataService.exportEnvironments(workspaceId)
        case 'mcp_servers':
          return dataService.exportMcpServers(workspaceId)
        case 'config':
          return dataService.exportConfig()
        default:
          throw new Error(`Unknown export type: ${type}`)
      }
    },
  )

  ipcMain.handle(IPC.DATA_EXPORT_COLLECTION, async (_event, collectionId: string) => {
    return dataService.exportSingleCollection(collectionId)
  })

  ipcMain.handle(IPC.DATA_EXPORT_MCP_SERVER, async (_event, serverId: string) => {
    return dataService.exportSingleMcpServer(serverId)
  })

  ipcMain.handle(IPC.DATA_EXPORT_OPENAPI, async (_event, collectionId: string) => {
    return exportOpenAPI(collectionId)
  })

  ipcMain.handle(IPC.DATA_EXPORT_POSTMAN, async (_event, collectionId: string) => {
    return exportPostman(collectionId)
  })

  ipcMain.handle(IPC.DATA_PICK_AND_READ, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'API Files', extensions: ['json', 'yaml', 'yml'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    const name = filePath.split(/[\\/]/).pop() ?? 'import.json'
    return { content, name }
  })

  ipcMain.handle(IPC.DATA_IMPORT, async (_event, json: string, workspaceId?: string) => {
    if (typeof json !== 'string' || json.length > MAX_IMPORT_SIZE) {
      throw new Error(`Import data too large (max ${MAX_IMPORT_SIZE / 1024 / 1024}MB)`)
    }
    return dataService.importData(json, workspaceId)
  })

  ipcMain.handle(IPC.POSTMAN_IMPORT, async (_event, json: string, workspaceId?: string) => {
    if (typeof json !== 'string' || json.length > MAX_IMPORT_SIZE) {
      throw new Error(`Import data too large (max ${MAX_IMPORT_SIZE / 1024 / 1024}MB)`)
    }
    return importPostman(json, workspaceId)
  })

  ipcMain.handle(IPC.INSOMNIA_IMPORT, async (_event, json: string, workspaceId?: string) => {
    if (typeof json !== 'string' || json.length > MAX_IMPORT_SIZE) {
      throw new Error(`Import data too large (max ${MAX_IMPORT_SIZE / 1024 / 1024}MB)`)
    }
    return importInsomnia(json, workspaceId)
  })

  ipcMain.handle(IPC.OPENAPI_IMPORT, async (_event, input: string, workspaceId?: string) => {
    if (typeof input !== 'string' || input.length > MAX_IMPORT_SIZE) {
      throw new Error(`Import data too large (max ${MAX_IMPORT_SIZE / 1024 / 1024}MB)`)
    }
    return importOpenAPI(input, workspaceId)
  })
}
