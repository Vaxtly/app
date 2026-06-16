/**
 * IPC channel names and payload types for main↔renderer communication.
 * Pattern: 'domain:action'
 */

// --- Channel name constants ---

export const IPC = {
  // Workspaces
  WORKSPACES_LIST: 'workspaces:list',
  WORKSPACES_CREATE: 'workspaces:create',
  WORKSPACES_UPDATE: 'workspaces:update',
  WORKSPACES_DELETE: 'workspaces:delete',

  // Collections
  COLLECTIONS_LIST: 'collections:list',
  COLLECTIONS_CREATE: 'collections:create',
  COLLECTIONS_GET: 'collections:get',
  COLLECTIONS_UPDATE: 'collections:update',
  COLLECTIONS_DELETE: 'collections:delete',
  COLLECTIONS_REORDER: 'collections:reorder',

  // Folders
  FOLDERS_LIST: 'folders:list',
  FOLDERS_CREATE: 'folders:create',
  FOLDERS_GET: 'folders:get',
  FOLDERS_UPDATE: 'folders:update',
  FOLDERS_DELETE: 'folders:delete',
  FOLDERS_REORDER: 'folders:reorder',

  // Requests
  REQUESTS_LIST: 'requests:list',
  REQUESTS_CREATE: 'requests:create',
  REQUESTS_GET: 'requests:get',
  REQUESTS_UPDATE: 'requests:update',
  REQUESTS_DELETE: 'requests:delete',
  REQUESTS_REORDER: 'requests:reorder',
  REQUESTS_MOVE: 'requests:move',

  // Environments
  ENVIRONMENTS_LIST: 'environments:list',
  ENVIRONMENTS_CREATE: 'environments:create',
  ENVIRONMENTS_GET: 'environments:get',
  ENVIRONMENTS_UPDATE: 'environments:update',
  ENVIRONMENTS_DELETE: 'environments:delete',
  ENVIRONMENTS_REORDER: 'environments:reorder',
  ENVIRONMENTS_ACTIVATE: 'environments:activate',
  ENVIRONMENTS_DEACTIVATE: 'environments:deactivate',
  ENVIRONMENTS_IMPORT_DOTENV: 'environments:import-dotenv',

  // Variables
  VARIABLES_RESOLVE: 'variables:resolve',
  VARIABLES_RESOLVE_WITH_SOURCE: 'variables:resolve-with-source',

  // HTTP Proxy
  PROXY_SEND: 'proxy:send',
  PROXY_CANCEL: 'proxy:cancel',
  PROXY_PICK_FILE: 'proxy:pick-file',
  PROXY_PICK_CERT_FILE: 'proxy:pick-cert-file',

  // Sync
  SYNC_TEST_CONNECTION: 'sync:test-connection',
  SYNC_PULL: 'sync:pull',
  SYNC_PUSH_COLLECTION: 'sync:push-collection',
  SYNC_PUSH_ALL: 'sync:push-all',
  SYNC_RESOLVE_CONFLICT: 'sync:resolve-conflict',
  SYNC_DELETE_REMOTE: 'sync:delete-remote',
  SYNC_SCAN_SENSITIVE: 'sync:scan-sensitive',
  SYNC_PUSH_REQUEST: 'sync:push-request',
  SYNC_PULL_COLLECTION: 'sync:pull-collection',
  SYNC_PUSH_MCP_SERVER: 'sync:push-mcp-server',
  SYNC_PULL_MCP_SERVER: 'sync:pull-mcp-server',
  SYNC_SCAN_MCP_SENSITIVE: 'sync:scan-mcp-sensitive',

  // Vault
  VAULT_TEST_CONNECTION: 'vault:test-connection',
  VAULT_PULL: 'vault:pull',
  VAULT_PUSH: 'vault:push',
  VAULT_PULL_ALL: 'vault:pull-all',
  VAULT_FETCH_VARIABLES: 'vault:fetch-variables',
  VAULT_GET_CACHED_VARIABLES: 'vault:get-cached-variables',
  VAULT_PUSH_VARIABLES: 'vault:push-variables',
  VAULT_DELETE_SECRETS: 'vault:delete-secrets',
  VAULT_MIGRATE: 'vault:migrate',

  // Data Import/Export
  DATA_EXPORT: 'data:export',
  DATA_EXPORT_COLLECTION: 'data:export-collection',
  DATA_EXPORT_MCP_SERVER: 'data:export-mcp-server',
  DATA_EXPORT_OPENAPI: 'data:export-openapi',
  DATA_EXPORT_POSTMAN: 'data:export-postman',
  DATA_IMPORT: 'data:import',
  DATA_PICK_AND_READ: 'data:pick-and-read',
  POSTMAN_IMPORT: 'postman:import',
  INSOMNIA_IMPORT: 'insomnia:import',
  OPENAPI_IMPORT: 'openapi:import',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Workspace Settings
  WORKSPACE_SETTINGS_GET: 'workspace-settings:get',
  WORKSPACE_SETTINGS_SET: 'workspace-settings:set',
  WORKSPACE_SETTINGS_GET_ALL: 'workspace-settings:get-all',

  // Window
  WINDOW_GET_STATE: 'window:get-state',
  WINDOW_SAVE_STATE: 'window:save-state',
  WINDOW_DRAG_START: 'window:drag-start',
  WINDOW_DRAG_MOVE: 'window:drag-move',

  // OAuth 2.0
  OAUTH2_GET_TOKEN: 'oauth2:get-token',
  OAUTH2_REFRESH_TOKEN: 'oauth2:refresh-token',
  OAUTH2_CLEAR_TOKEN: 'oauth2:clear-token',

  // Code Generator
  CODE_GENERATE: 'code:generate',

  // Sync — MCP server delete/orphan
  SYNC_DELETE_MCP_SERVER_REMOTE: 'sync:delete-mcp-server-remote',
  SYNC_RESOLVE_MCP_ORPHAN: 'sync:resolve-mcp-orphan',

  // Sync events (main→renderer push)
  SYNC_CONFLICT: 'sync:conflict',
  SYNC_ORPHANED_COLLECTIONS: 'sync:orphaned-collections',
  SYNC_ORPHANED_MCP_SERVERS: 'sync:orphaned-mcp-servers',
  SYNC_PULL_COMPLETE: 'sync:pull-complete',

  // Sync resolve (renderer→main invoke)
  SYNC_RESOLVE_ORPHAN: 'sync:resolve-orphan',

  // SSE streaming (main→renderer push)
  SSE_STREAM_START: 'sse:stream-start',
  SSE_STREAM_CHUNK: 'sse:stream-chunk',
  SSE_STREAM_END: 'sse:stream-end',

  // Session Log (main→renderer push)
  LOG_PUSH: 'log:push',
  LOG_LIST: 'log:list',
  LOG_CLEAR: 'log:clear',

  // Clipboard (main→renderer push)
  CLIPBOARD_TEXT: 'clipboard:text',

  // Menu events (main→renderer push)
  MENU_NEW_REQUEST: 'menu:new-request',
  MENU_SAVE_REQUEST: 'menu:save-request',
  MENU_OPEN_SETTINGS: 'menu:open-settings',
  MENU_CHECK_UPDATES: 'menu:check-updates',
  MENU_SHOW_WELCOME: 'menu:show-welcome',

  // Auto-update (main→renderer push + renderer→main invoke)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_PROGRESS: 'update:progress',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_INSTALL_SOURCE: 'update:install-source',

  // MCP Servers — CRUD
  MCP_SERVERS_LIST: 'mcp:servers-list',
  MCP_SERVERS_CREATE: 'mcp:servers-create',
  MCP_SERVERS_UPDATE: 'mcp:servers-update',
  MCP_SERVERS_DELETE: 'mcp:servers-delete',
  MCP_SERVERS_REORDER: 'mcp:servers-reorder',

  // MCP — Connection
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',

  // MCP — Primitives
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',
  MCP_LIST_RESOURCES: 'mcp:list-resources',
  MCP_READ_RESOURCE: 'mcp:read-resource',
  MCP_LIST_RESOURCE_TEMPLATES: 'mcp:list-resource-templates',
  MCP_LIST_PROMPTS: 'mcp:list-prompts',
  MCP_GET_PROMPT: 'mcp:get-prompt',

  // MCP — Traffic
  MCP_TRAFFIC_LIST: 'mcp:traffic-list',
  MCP_TRAFFIC_CLEAR: 'mcp:traffic-clear',

  // MCP — Push events (main→renderer)
  MCP_STATUS_CHANGED: 'mcp:status-changed',
  MCP_NOTIFICATION: 'mcp:notification',
  MCP_TRAFFIC_PUSH: 'mcp:traffic-push',
  MCP_TOOLS_CHANGED: 'mcp:tools-changed',
  MCP_RESOURCES_CHANGED: 'mcp:resources-changed',
  MCP_PROMPTS_CHANGED: 'mcp:prompts-changed',

  // WebSocket
  WS_CONNECT: 'ws:connect',
  WS_DISCONNECT: 'ws:disconnect',
  WS_SEND: 'ws:send',
  WS_MESSAGES_LIST: 'ws:messages-list',
  WS_MESSAGES_CLEAR: 'ws:messages-clear',

  // WebSocket — Push events (main→renderer)
  WS_STATUS_CHANGED: 'ws:status-changed',
  WS_MESSAGE_RECEIVED: 'ws:message-received',

  // GraphQL
  GRAPHQL_INTROSPECT: 'graphql:introspect',

  // Collection Runner
  RUNNER_START: 'runner:start',
  RUNNER_CANCEL: 'runner:cancel',

  // Collection Runner — Push events (main→renderer)
  RUNNER_STARTED: 'runner:started',
  RUNNER_PROGRESS: 'runner:progress',
  RUNNER_COMPLETE: 'runner:complete',

  // Cookie Jar
  COOKIES_LIST: 'cookies:list',
  COOKIES_CLEAR: 'cookies:clear',
  COOKIES_DELETE: 'cookies:delete',

  // GraphQL Subscriptions
  GQL_SUB_SUBSCRIBE: 'gql-sub:subscribe',
  GQL_SUB_UNSUBSCRIBE: 'gql-sub:unsubscribe',

  // GraphQL Subscriptions — Push events (main→renderer)
  GQL_SUB_STATUS_CHANGED: 'gql-sub:status-changed',
  GQL_SUB_EVENT: 'gql-sub:event',

  // CLI / Agent integration — bundled `vaxtly` CLI installation onto PATH
  CLI_INSTALL_ON_PATH: 'cli:install-on-path',
  CLI_PATH_STATUS: 'cli:path-status',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
