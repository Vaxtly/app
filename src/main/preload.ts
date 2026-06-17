import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AgentDataChangedEvent } from '../shared/types/ipc'
import type { Workspace, Collection, Folder, Request, Environment, AppSetting, WindowState } from '../shared/types/models'
import type { RequestConfig, ResponseData, SSEStreamStart, SSEChunk, SSEStreamEnd } from '../shared/types/http'
import type { SyncResult, SyncConflict, OrphanedCollection, OrphanedMcpServer, SessionLogEntry } from '../shared/types/sync'
import type { SensitiveFinding } from './services/sensitive-data-scanner'
import type { CodeLanguage, CodeGenRequest } from './services/code-generator'
import type { EnvironmentVariable } from '../shared/types/models'
import type { PostmanImportResult } from './services/postman-import'
import type { InsomniaImportResult } from './services/insomnia-import'
import type { McpServer, McpServerState, McpTool, McpResource, McpResourceTemplate, McpPrompt, McpToolCallResult, McpResourceReadResult, McpPromptGetResult, McpTrafficEntry, McpNotification } from '../shared/types/mcp'
import type { WsConnectionConfig, WsConnectionState, WsMessage, WsStatusChanged, WsMessageReceived } from '../shared/types/websocket'
import type { CollectionRunResult, RunnerStartedEvent, RunnerProgressEvent } from '../shared/types/runner'
import type { StoredCookie } from '../shared/types/cookies'
import type { GqlSubscriptionEvent, GqlSubStatusChanged } from '../shared/types/graphql-subscription'

const api = {
  workspaces: {
    list: (): Promise<Workspace[]> =>
      ipcRenderer.invoke(IPC.WORKSPACES_LIST),
    create: (data: { name: string; description?: string }): Promise<Workspace> =>
      ipcRenderer.invoke(IPC.WORKSPACES_CREATE, data),
    update: (id: string, data: Partial<Workspace>): Promise<Workspace | undefined> =>
      ipcRenderer.invoke(IPC.WORKSPACES_UPDATE, id, data),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.WORKSPACES_DELETE, id),
  },

  collections: {
    list: (workspaceId?: string): Promise<Collection[]> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_LIST, workspaceId),
    get: (id: string): Promise<Collection | undefined> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_GET, id),
    create: (data: { name: string; workspace_id?: string; description?: string }): Promise<Collection> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_CREATE, data),
    update: (id: string, data: Partial<Collection>): Promise<Collection | undefined> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_UPDATE, id, data),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_DELETE, id),
    reorder: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.COLLECTIONS_REORDER, ids),
  },

  folders: {
    list: (collectionId: string): Promise<Folder[]> =>
      ipcRenderer.invoke(IPC.FOLDERS_LIST, collectionId),
    get: (id: string): Promise<Folder | undefined> =>
      ipcRenderer.invoke(IPC.FOLDERS_GET, id),
    create: (data: { collection_id: string; name: string; parent_id?: string }): Promise<Folder> =>
      ipcRenderer.invoke(IPC.FOLDERS_CREATE, data),
    update: (id: string, data: Partial<Folder>): Promise<Folder | undefined> =>
      ipcRenderer.invoke(IPC.FOLDERS_UPDATE, id, data),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.FOLDERS_DELETE, id),
    reorder: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.FOLDERS_REORDER, ids),
  },

  requests: {
    list: (collectionId: string): Promise<Request[]> =>
      ipcRenderer.invoke(IPC.REQUESTS_LIST, collectionId),
    get: (id: string): Promise<Request | undefined> =>
      ipcRenderer.invoke(IPC.REQUESTS_GET, id),
    create: (data: { collection_id: string; name: string; folder_id?: string; method?: string; url?: string; body_type?: string }): Promise<Request> =>
      ipcRenderer.invoke(IPC.REQUESTS_CREATE, data),
    update: (id: string, data: Partial<Request>): Promise<Request | undefined> =>
      ipcRenderer.invoke(IPC.REQUESTS_UPDATE, id, data),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.REQUESTS_DELETE, id),
    move: (id: string, targetFolderId: string | null, targetCollectionId?: string): Promise<Request | undefined> =>
      ipcRenderer.invoke(IPC.REQUESTS_MOVE, id, targetFolderId, targetCollectionId),
    reorder: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.REQUESTS_REORDER, ids),
  },

  environments: {
    list: (workspaceId?: string): Promise<Environment[]> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_LIST, workspaceId),
    get: (id: string): Promise<Environment | undefined> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_GET, id),
    create: (data: { name: string; workspace_id?: string; variables?: string }): Promise<Environment> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_CREATE, data),
    update: (id: string, data: Partial<Environment>): Promise<Environment | undefined> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_UPDATE, id, data),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_DELETE, id),
    reorder: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_REORDER, ids),
    activate: (id: string, workspaceId?: string): Promise<{ vaultFailed: boolean } | undefined> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_ACTIVATE, id, workspaceId),
    deactivate: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_DEACTIVATE, id),
    importDotenv: (workspaceId?: string): Promise<Environment | null> =>
      ipcRenderer.invoke(IPC.ENVIRONMENTS_IMPORT_DOTENV, workspaceId),
  },

  variables: {
    resolve: (workspaceId?: string, collectionId?: string): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.VARIABLES_RESOLVE, workspaceId, collectionId),
    resolveWithSource: (workspaceId?: string, collectionId?: string): Promise<Record<string, { value: string; source: string }>> =>
      ipcRenderer.invoke(IPC.VARIABLES_RESOLVE_WITH_SOURCE, workspaceId, collectionId),
  },

  proxy: {
    send: (requestId: string, config: RequestConfig): Promise<ResponseData> =>
      ipcRenderer.invoke(IPC.PROXY_SEND, requestId, config),
    cancel: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.PROXY_CANCEL, requestId),
    pickFile: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke(IPC.PROXY_PICK_FILE),
    pickCertFile: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke(IPC.PROXY_PICK_CERT_FILE),
  },

  sync: {
    testConnection: (workspaceId?: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SYNC_TEST_CONNECTION, workspaceId),
    pull: (workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PULL, workspaceId),
    pushCollection: (collectionId: string, sanitize?: boolean, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PUSH_COLLECTION, collectionId, sanitize, workspaceId),
    pushAll: (workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PUSH_ALL, workspaceId),
    resolveConflict: (collectionId: string, resolution: 'keep-local' | 'keep-remote', workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_RESOLVE_CONFLICT, collectionId, resolution, workspaceId),
    deleteRemote: (collectionId: string, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_DELETE_REMOTE, collectionId, workspaceId),
    scanSensitive: (collectionId: string): Promise<SensitiveFinding[]> =>
      ipcRenderer.invoke(IPC.SYNC_SCAN_SENSITIVE, collectionId),
    pushRequest: (collectionId: string, requestId: string, sanitize?: boolean, workspaceId?: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SYNC_PUSH_REQUEST, collectionId, requestId, sanitize, workspaceId),
    pullCollection: (collectionId: string, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PULL_COLLECTION, collectionId, workspaceId),
    pushMcpServer: (serverId: string, sanitize?: boolean, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PUSH_MCP_SERVER, serverId, sanitize, workspaceId),
    pullMcpServer: (serverId: string, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_PULL_MCP_SERVER, serverId, workspaceId),
    scanMcpSensitive: (serverId: string): Promise<SensitiveFinding[]> =>
      ipcRenderer.invoke(IPC.SYNC_SCAN_MCP_SENSITIVE, serverId),
    resolveOrphan: (collectionId: string, resolution: 'delete' | 'keep'): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_RESOLVE_ORPHAN, collectionId, resolution),
    deleteMcpServerRemote: (serverId: string, workspaceId?: string): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_DELETE_MCP_SERVER_REMOTE, serverId, workspaceId),
    resolveMcpOrphan: (serverId: string, resolution: 'delete' | 'keep'): Promise<SyncResult> =>
      ipcRenderer.invoke(IPC.SYNC_RESOLVE_MCP_ORPHAN, serverId, resolution),
  },

  vault: {
    testConnection: (workspaceId?: string): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke(IPC.VAULT_TEST_CONNECTION, workspaceId),
    pull: (workspaceId?: string): Promise<{ success: boolean; message: string; pulled?: number; errors?: string[] }> =>
      ipcRenderer.invoke(IPC.VAULT_PULL, workspaceId),
    push: (environmentId: string, workspaceId?: string): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke(IPC.VAULT_PUSH, environmentId, workspaceId),
    pullAll: (workspaceId?: string): Promise<{ success: boolean; created: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.VAULT_PULL_ALL, workspaceId),
    fetchVariables: (environmentId: string, workspaceId?: string): Promise<EnvironmentVariable[]> =>
      ipcRenderer.invoke(IPC.VAULT_FETCH_VARIABLES, environmentId, workspaceId),
    getCachedVariables: (environmentId: string): Promise<EnvironmentVariable[]> =>
      ipcRenderer.invoke(IPC.VAULT_GET_CACHED_VARIABLES, environmentId),
    pushVariables: (environmentId: string, variables: EnvironmentVariable[], workspaceId?: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke(IPC.VAULT_PUSH_VARIABLES, environmentId, variables, workspaceId),
    deleteSecrets: (environmentId: string, workspaceId?: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke(IPC.VAULT_DELETE_SECRETS, environmentId, workspaceId),
    migrate: (environmentId: string, oldPath: string, newPath: string, workspaceId?: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke(IPC.VAULT_MIGRATE, environmentId, oldPath, newPath, workspaceId),
  },

  data: {
    export: (type: 'all' | 'collections' | 'environments' | 'mcp_servers' | 'config', workspaceId?: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.DATA_EXPORT, type, workspaceId),
    exportCollection: (collectionId: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.DATA_EXPORT_COLLECTION, collectionId),
    exportMcpServer: (serverId: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.DATA_EXPORT_MCP_SERVER, serverId),
    exportOpenAPI: (collectionId: string): Promise<string> =>
      ipcRenderer.invoke(IPC.DATA_EXPORT_OPENAPI, collectionId),
    exportPostman: (collectionId: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.DATA_EXPORT_POSTMAN, collectionId),
    pickAndRead: (): Promise<{ content: string; name: string } | null> =>
      ipcRenderer.invoke(IPC.DATA_PICK_AND_READ),
    import: (json: string, workspaceId?: string): Promise<{ collections: number; environments: number; mcp_servers: number; config: boolean; errors: string[] }> =>
      ipcRenderer.invoke(IPC.DATA_IMPORT, json, workspaceId),
    importPostman: (json: string, workspaceId?: string): Promise<PostmanImportResult> =>
      ipcRenderer.invoke(IPC.POSTMAN_IMPORT, json, workspaceId),
    importInsomnia: (json: string, workspaceId?: string): Promise<InsomniaImportResult> =>
      ipcRenderer.invoke(IPC.INSOMNIA_IMPORT, json, workspaceId),
    importOpenAPI: (input: string, workspaceId?: string): Promise<{ collections: number; requests: number; folders: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.OPENAPI_IMPORT, input, workspaceId),
  },

  graphql: {
    introspect: (config: { url: string; headers?: Record<string, string>; workspaceId?: string; collectionId?: string }): Promise<unknown> =>
      ipcRenderer.invoke(IPC.GRAPHQL_INTROSPECT, config),
  },

  runner: {
    start: (collectionId: string, workspaceId?: string): Promise<CollectionRunResult> =>
      ipcRenderer.invoke(IPC.RUNNER_START, collectionId, workspaceId),
    cancel: (runId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.RUNNER_CANCEL, runId),
  },

  cookies: {
    list: (): Promise<StoredCookie[]> =>
      ipcRenderer.invoke(IPC.COOKIES_LIST),
    clear: (): Promise<void> =>
      ipcRenderer.invoke(IPC.COOKIES_CLEAR),
    delete: (domain: string, name: string): Promise<void> =>
      ipcRenderer.invoke(IPC.COOKIES_DELETE, domain, name),
  },

  gqlSub: {
    subscribe: (requestId: string, config: { url: string; query: string; variables?: Record<string, unknown>; headers?: Record<string, string>; workspaceId?: string; collectionId?: string }): Promise<void> =>
      ipcRenderer.invoke(IPC.GQL_SUB_SUBSCRIBE, requestId, config),
    unsubscribe: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.GQL_SUB_UNSUBSCRIBE, requestId),
  },

  oauth2: {
    getToken: (requestId: string): Promise<import('../shared/types/models').AuthConfig> =>
      ipcRenderer.invoke(IPC.OAUTH2_GET_TOKEN, requestId),
    refreshToken: (requestId: string): Promise<import('../shared/types/models').AuthConfig> =>
      ipcRenderer.invoke(IPC.OAUTH2_REFRESH_TOKEN, requestId),
    clearToken: (requestId: string): Promise<import('../shared/types/models').AuthConfig> =>
      ipcRenderer.invoke(IPC.OAUTH2_CLEAR_TOKEN, requestId),
  },

  codeGenerator: {
    generate: (language: CodeLanguage, data: CodeGenRequest, workspaceId?: string, collectionId?: string): Promise<string> =>
      ipcRenderer.invoke(IPC.CODE_GENERATE, language, data, workspaceId, collectionId),
  },

  log: {
    list: (): Promise<SessionLogEntry[]> =>
      ipcRenderer.invoke(IPC.LOG_LIST),
    clear: (): Promise<void> =>
      ipcRenderer.invoke(IPC.LOG_CLEAR),
  },

  updater: {
    check: (): Promise<void> =>
      ipcRenderer.invoke(IPC.UPDATE_CHECK),
    install: (): Promise<void> =>
      ipcRenderer.invoke(IPC.UPDATE_INSTALL),
    installSource: (): Promise<'brew' | 'scoop' | 'snap' | 'standalone'> =>
      ipcRenderer.invoke(IPC.UPDATE_INSTALL_SOURCE),
  },

  mcp: {
    servers: {
      list: (workspaceId: string): Promise<McpServer[]> =>
        ipcRenderer.invoke(IPC.MCP_SERVERS_LIST, workspaceId),
      create: (data: { workspace_id: string; name: string; transport_type?: string; command?: string; args?: string; env?: string; cwd?: string; url?: string; headers?: string }): Promise<McpServer> =>
        ipcRenderer.invoke(IPC.MCP_SERVERS_CREATE, data),
      update: (id: string, data: Partial<McpServer>): Promise<McpServer | undefined> =>
        ipcRenderer.invoke(IPC.MCP_SERVERS_UPDATE, id, data),
      delete: (id: string): Promise<boolean> =>
        ipcRenderer.invoke(IPC.MCP_SERVERS_DELETE, id),
      reorder: (ids: string[]): Promise<void> =>
        ipcRenderer.invoke(IPC.MCP_SERVERS_REORDER, ids),
    },
    connect: (serverId: string): Promise<McpServerState> =>
      ipcRenderer.invoke(IPC.MCP_CONNECT, serverId),
    disconnect: (serverId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.MCP_DISCONNECT, serverId),
    listTools: (serverId: string): Promise<McpTool[]> =>
      ipcRenderer.invoke(IPC.MCP_LIST_TOOLS, serverId),
    callTool: (serverId: string, name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> =>
      ipcRenderer.invoke(IPC.MCP_CALL_TOOL, serverId, name, args),
    listResources: (serverId: string): Promise<McpResource[]> =>
      ipcRenderer.invoke(IPC.MCP_LIST_RESOURCES, serverId),
    readResource: (serverId: string, uri: string): Promise<McpResourceReadResult> =>
      ipcRenderer.invoke(IPC.MCP_READ_RESOURCE, serverId, uri),
    listResourceTemplates: (serverId: string): Promise<McpResourceTemplate[]> =>
      ipcRenderer.invoke(IPC.MCP_LIST_RESOURCE_TEMPLATES, serverId),
    listPrompts: (serverId: string): Promise<McpPrompt[]> =>
      ipcRenderer.invoke(IPC.MCP_LIST_PROMPTS, serverId),
    getPrompt: (serverId: string, name: string, args?: Record<string, string>): Promise<McpPromptGetResult> =>
      ipcRenderer.invoke(IPC.MCP_GET_PROMPT, serverId, name, args),
    traffic: {
      list: (serverId?: string): Promise<McpTrafficEntry[]> =>
        ipcRenderer.invoke(IPC.MCP_TRAFFIC_LIST, serverId),
      clear: (serverId?: string): Promise<void> =>
        ipcRenderer.invoke(IPC.MCP_TRAFFIC_CLEAR, serverId),
    },
  },

  ws: {
    connect: (connectionId: string, config: WsConnectionConfig): Promise<WsConnectionState> =>
      ipcRenderer.invoke(IPC.WS_CONNECT, connectionId, config),
    disconnect: (connectionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.WS_DISCONNECT, connectionId),
    send: (connectionId: string, data: string): Promise<WsMessage> =>
      ipcRenderer.invoke(IPC.WS_SEND, connectionId, data),
    messages: {
      list: (connectionId: string): Promise<WsMessage[]> =>
        ipcRenderer.invoke(IPC.WS_MESSAGES_LIST, connectionId),
      clear: (connectionId: string): Promise<void> =>
        ipcRenderer.invoke(IPC.WS_MESSAGES_CLEAR, connectionId),
    },
  },

  settings: {
    get: (key: string): Promise<string | undefined> =>
      ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
    getAll: (): Promise<AppSetting[]> =>
      ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
  },

  workspaceSettings: {
    get: (workspaceId: string, key: string): Promise<string | undefined> =>
      ipcRenderer.invoke(IPC.WORKSPACE_SETTINGS_GET, workspaceId, key),
    set: (workspaceId: string, key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(IPC.WORKSPACE_SETTINGS_SET, workspaceId, key, value),
    getAll: (workspaceId: string): Promise<Record<string, Record<string, unknown>>> =>
      ipcRenderer.invoke(IPC.WORKSPACE_SETTINGS_GET_ALL, workspaceId),
  },

  window: {
    getState: (): Promise<WindowState> =>
      ipcRenderer.invoke(IPC.WINDOW_GET_STATE),
    saveState: (state: WindowState): Promise<void> =>
      ipcRenderer.invoke(IPC.WINDOW_SAVE_STATE, state),
    dragStart: (): void =>
      ipcRenderer.send(IPC.WINDOW_DRAG_START),
    dragMove: (dx: number, dy: number): void =>
      ipcRenderer.send(IPC.WINDOW_DRAG_MOVE, dx, dy),
  },

  // Event listeners for main→renderer pushes
  on: {
    logPush: (callback: (entry: SessionLogEntry) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: SessionLogEntry): void => {
        callback(entry)
      }
      ipcRenderer.on(IPC.LOG_PUSH, handler)
      return () => ipcRenderer.removeListener(IPC.LOG_PUSH, handler)
    },
    menuNewRequest: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.MENU_NEW_REQUEST, handler)
      return () => ipcRenderer.removeListener(IPC.MENU_NEW_REQUEST, handler)
    },
    menuSaveRequest: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.MENU_SAVE_REQUEST, handler)
      return () => ipcRenderer.removeListener(IPC.MENU_SAVE_REQUEST, handler)
    },
    menuOpenSettings: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.MENU_OPEN_SETTINGS, handler)
      return () => ipcRenderer.removeListener(IPC.MENU_OPEN_SETTINGS, handler)
    },
    menuCheckUpdates: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.MENU_CHECK_UPDATES, handler)
      return () => ipcRenderer.removeListener(IPC.MENU_CHECK_UPDATES, handler)
    },
    menuShowWelcome: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.MENU_SHOW_WELCOME, handler)
      return () => ipcRenderer.removeListener(IPC.MENU_SHOW_WELCOME, handler)
    },
    clipboardText: (callback: (text: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string): void => {
        callback(text)
      }
      ipcRenderer.on(IPC.CLIPBOARD_TEXT, handler)
      return () => ipcRenderer.removeListener(IPC.CLIPBOARD_TEXT, handler)
    },
    updateAvailable: (callback: (data: { version: string; releaseName: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { version: string; releaseName: string }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.UPDATE_AVAILABLE, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATE_AVAILABLE, handler)
    },
    updateNotAvailable: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.UPDATE_NOT_AVAILABLE, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATE_NOT_AVAILABLE, handler)
    },
    updateProgress: (callback: (data: { percent: number }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { percent: number }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.UPDATE_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATE_PROGRESS, handler)
    },
    updateDownloaded: (callback: (data: { version: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { version: string }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.UPDATE_DOWNLOADED, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATE_DOWNLOADED, handler)
    },
    updateError: (callback: (message: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: string): void => {
        callback(message)
      }
      ipcRenderer.on(IPC.UPDATE_ERROR, handler)
      return () => ipcRenderer.removeListener(IPC.UPDATE_ERROR, handler)
    },
    syncConflict: (callback: (conflicts: SyncConflict[]) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, conflicts: SyncConflict[]): void => {
        callback(conflicts)
      }
      ipcRenderer.on(IPC.SYNC_CONFLICT, handler)
      return () => ipcRenderer.removeListener(IPC.SYNC_CONFLICT, handler)
    },
    syncOrphanedCollections: (callback: (orphaned: OrphanedCollection[]) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, orphaned: OrphanedCollection[]): void => {
        callback(orphaned)
      }
      ipcRenderer.on(IPC.SYNC_ORPHANED_COLLECTIONS, handler)
      return () => ipcRenderer.removeListener(IPC.SYNC_ORPHANED_COLLECTIONS, handler)
    },
    syncOrphanedMcpServers: (callback: (orphaned: OrphanedMcpServer[]) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, orphaned: OrphanedMcpServer[]): void => {
        callback(orphaned)
      }
      ipcRenderer.on(IPC.SYNC_ORPHANED_MCP_SERVERS, handler)
      return () => ipcRenderer.removeListener(IPC.SYNC_ORPHANED_MCP_SERVERS, handler)
    },
    syncPullComplete: (callback: (workspaceId: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, workspaceId: string): void => {
        callback(workspaceId)
      }
      ipcRenderer.on(IPC.SYNC_PULL_COMPLETE, handler)
      return () => ipcRenderer.removeListener(IPC.SYNC_PULL_COMPLETE, handler)
    },
    agentDataChanged: (callback: (event: AgentDataChangedEvent) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AgentDataChangedEvent): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.AGENT_DATA_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.AGENT_DATA_CHANGED, handler)
    },
    sseStreamStart: (callback: (data: SSEStreamStart) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: SSEStreamStart): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.SSE_STREAM_START, handler)
      return () => ipcRenderer.removeListener(IPC.SSE_STREAM_START, handler)
    },
    sseStreamChunk: (callback: (data: SSEChunk) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: SSEChunk): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.SSE_STREAM_CHUNK, handler)
      return () => ipcRenderer.removeListener(IPC.SSE_STREAM_CHUNK, handler)
    },
    sseStreamEnd: (callback: (data: SSEStreamEnd) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: SSEStreamEnd): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.SSE_STREAM_END, handler)
      return () => ipcRenderer.removeListener(IPC.SSE_STREAM_END, handler)
    },
    mcpStatusChanged: (callback: (data: { serverId: string; status: string; error: string | null }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { serverId: string; status: string; error: string | null }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.MCP_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_STATUS_CHANGED, handler)
    },
    mcpNotification: (callback: (entry: McpNotification) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: McpNotification): void => {
        callback(entry)
      }
      ipcRenderer.on(IPC.MCP_NOTIFICATION, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_NOTIFICATION, handler)
    },
    mcpTrafficPush: (callback: (entry: McpTrafficEntry) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: McpTrafficEntry): void => {
        callback(entry)
      }
      ipcRenderer.on(IPC.MCP_TRAFFIC_PUSH, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_TRAFFIC_PUSH, handler)
    },
    mcpToolsChanged: (callback: (data: { serverId: string; tools: McpTool[] }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { serverId: string; tools: McpTool[] }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.MCP_TOOLS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_TOOLS_CHANGED, handler)
    },
    mcpResourcesChanged: (callback: (data: { serverId: string; resources: McpResource[]; resourceTemplates: McpResourceTemplate[] }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { serverId: string; resources: McpResource[]; resourceTemplates: McpResourceTemplate[] }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.MCP_RESOURCES_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_RESOURCES_CHANGED, handler)
    },
    mcpPromptsChanged: (callback: (data: { serverId: string; prompts: McpPrompt[] }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { serverId: string; prompts: McpPrompt[] }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.MCP_PROMPTS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.MCP_PROMPTS_CHANGED, handler)
    },
    wsStatusChanged: (callback: (data: WsStatusChanged) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: WsStatusChanged): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.WS_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.WS_STATUS_CHANGED, handler)
    },
    wsMessageReceived: (callback: (data: WsMessageReceived) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: WsMessageReceived): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.WS_MESSAGE_RECEIVED, handler)
      return () => ipcRenderer.removeListener(IPC.WS_MESSAGE_RECEIVED, handler)
    },
    runnerStarted: (callback: (data: RunnerStartedEvent) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: RunnerStartedEvent): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.RUNNER_STARTED, handler)
      return () => ipcRenderer.removeListener(IPC.RUNNER_STARTED, handler)
    },
    runnerProgress: (callback: (data: RunnerProgressEvent) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: RunnerProgressEvent): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.RUNNER_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.RUNNER_PROGRESS, handler)
    },
    runnerComplete: (callback: (data: CollectionRunResult) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: CollectionRunResult): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.RUNNER_COMPLETE, handler)
      return () => ipcRenderer.removeListener(IPC.RUNNER_COMPLETE, handler)
    },
    gqlSubStatusChanged: (callback: (data: GqlSubStatusChanged) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: GqlSubStatusChanged): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.GQL_SUB_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.GQL_SUB_STATUS_CHANGED, handler)
    },
    gqlSubEvent: (callback: (data: { requestId: string; event: GqlSubscriptionEvent }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; event: GqlSubscriptionEvent }): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.GQL_SUB_EVENT, handler)
      return () => ipcRenderer.removeListener(IPC.GQL_SUB_EVENT, handler)
    },
  },

  cli: {
    // Status: where the bundled CLI lives + whether the `vaxtly` symlink is
    // already on PATH at ~/.local/bin/vaxtly.
    status: () => ipcRenderer.invoke(IPC.CLI_PATH_STATUS),
    // Install: symlinks the bundled CLI into ~/.local/bin/vaxtly (POSIX).
    install: () => ipcRenderer.invoke(IPC.CLI_INSTALL_ON_PATH),
  },
}

export type API = typeof api

contextBridge.exposeInMainWorld('api', api)
