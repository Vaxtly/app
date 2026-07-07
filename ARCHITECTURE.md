# Vaxtly — Architecture Reference

> A fast, native API client for developers. Built with Electron, TypeScript, and Svelte 5.
> This document is the single source of truth for the project's architecture.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Electron | 35 |
| Build | electron-vite | 3 |
| UI | Svelte 5 (runes) | 5 |
| CSS | Tailwind CSS | 4 |
| Editor | CodeMirror + cm6-graphql | 6 |
| Database | better-sqlite3 (SQLite WAL) | 12 |
| HTTP | undici (Agent + ProxyAgent for TLS/proxy) | 7 |
| Auto-update | electron-updater | 6 |
| Encryption | Electron safeStorage + AES-256-GCM | — |
| Tests (unit) | Vitest | 4 |
| Tests (e2e) | Playwright Electron | 1 |
| MCP | @modelcontextprotocol/sdk | 1 |
| Types | TypeScript strict | 5.7 |

## Project Structure

```
vaxtly/
├── src/
│   ├── shared/                          # Types shared main↔renderer
│   │   ├── types/
│   │   │   ├── models.ts               # All entity interfaces
│   │   │   ├── ipc.ts                  # IPC channel constants
│   │   │   ├── http.ts                 # RequestConfig, ResponseData, etc.
│   │   │   ├── mcp.ts                  # MCP types: McpServer, McpServerState, McpTool, McpResource, McpPrompt, traffic/notifications
│   │   │   ├── sync.ts                 # SyncConfig, VaultConfig, ConflictChange, OrphanedCollection, SessionLogEntry, HttpLogDetail
│   │   │   ├── websocket.ts            # WsConnectionStatus, WsConnectionConfig, WsConnectionState, WsMessage, WsStatusChanged, WsMessageReceived
│   │   │   ├── runner.ts              # CollectionRunResult, RequestRunResult, RunnerStartedEvent, RunnerProgressEvent
│   │   │   ├── cookies.ts             # StoredCookie
│   │   │   └── graphql-subscription.ts # GqlSubscriptionEvent, GqlSubscriptionStatus, GqlSubStatusChanged
│   │   ├── constants.ts                # HTTP_METHODS, BODY_TYPES, AUTH_TYPES, SENSITIVE_*, isWebSocketRequest(), WS_MESSAGE_LOG_MAX
│   │   └── curl-parser.ts             # Pure cURL command parser (isCurlCommand, parseCurl → ParsedCurl)
│   ├── main/
│   │   ├── index.ts                    # App lifecycle, window, boot sequence
│   │   ├── menu.ts                     # Native menu + accelerators
│   │   ├── preload.ts                  # contextBridge typed API
│   │   ├── database/
│   │   │   ├── connection.ts           # SQLite open/close + migration runner
│   │   │   ├── migrations/
│   │   │   │   ├── types.ts            # MigrationFile interface
│   │   │   │   ├── 001_initial_schema.ts
│   │   │   │   ├── 002_mcp_servers.ts
│   │   │   │   ├── 003_mcp_sync_fields.ts
│   │   │   │   ├── 004_websocket.ts       # websocket_messages table
│   │   │   │   ├── 005_indexes_and_constraints.ts # updated_at indexes, vault-synced CHECK constraint
│   │   │   │   ├── 006_collection_folder_auth.ts # auth column on collections + folders
│   │   │   │   ├── 007_collection_folder_scripts.ts # scripts column on collections + folders
│   │   │   │   ├── 008_environment_parent.ts # parent_id column on environments (root → child inheritance, depth cap 2)
│   │   │   │   └── 009_external_keys.ts # external_key TEXT column + partial unique indexes on collections/folders/requests/environments (idempotency handle for the agent socket)
│   │   │   └── repositories/
│   │   │       ├── workspaces.ts
│   │   │       ├── collections.ts
│   │   │       ├── folders.ts
│   │   │       ├── requests.ts
│   │   │       ├── environments.ts
│   │   │       ├── mcp-servers.ts        # MCP server CRUD + reorder + sync (markDirty, findDirtyOrNew, findSyncEnabled)
│   │   │       ├── websocket-messages.ts # WebSocket message log CRUD + trim
│   │   │       └── settings.ts
│   │   ├── actions/                    # Shared mutation entry points used by BOTH IPC and the agent socket
│   │   │   ├── collections.ts          # createCollection, updateCollection (passthrough)
│   │   │   ├── folders.ts              # createFolder, updateFolder (passthrough)
│   │   │   ├── requests.ts             # create/update/delete/move/reorderRequest — also fires collectionsRepo.markDirty so socket + IPC stay in sync
│   │   │   └── environments.ts         # createEnvironment, updateEnvironment (passthrough)
│   │   ├── ipc/                        # IPC handler registration per domain
│   │   │   ├── workspaces.ts
│   │   │   ├── collections.ts
│   │   │   ├── folders.ts
│   │   │   ├── requests.ts
│   │   │   ├── environments.ts
│   │   │   ├── mcp.ts                 # MCP server CRUD, connect/disconnect, primitives, traffic
│   │   │   ├── proxy.ts               # HTTP proxy + var substitution + pre/post scripts
│   │   │   ├── variables.ts           # Variable resolution IPC (resolve, resolveWithSource) — async, ensures vault cache
│   │   │   ├── session-log.ts         # Session log list + clear
│   │   │   ├── oauth2.ts              # OAuth 2.0: get-token, refresh-token, clear-token
│   │   │   ├── code-generator.ts      # Code snippet generation
│   │   │   ├── graphql.ts            # GraphQL introspection (schema fetch via undici)
│   │   │   ├── sync.ts                # Git sync: test, pull, push, resolve, scan
│   │   │   ├── vault.ts               # Vault: test, pull, push, fetch/push vars, delete, migrate
│   │   │   ├── data-import-export.ts  # Data export/import + Postman/Insomnia import
│   │   │   ├── websocket.ts          # WebSocket: connect, disconnect, send, messages
│   │   │   ├── collection-runner.ts  # Collection runner: start, cancel + push events
│   │   │   ├── cookies.ts           # Cookie jar: list, clear, delete
│   │   │   ├── graphql-subscription.ts # GraphQL subscriptions: subscribe, unsubscribe + push events
│   │   │   ├── updater.ts            # Auto-update: check, install, install-source
│   │   │   └── settings.ts
│   │   ├── services/
│   │   │   ├── encryption.ts           # safeStorage master key + AES-256-GCM (CBC backward compat)
│   │   │   ├── variable-substitution.ts # {{var}} resolution, nested refs, env+collection merge
│   │   │   ├── script-execution.ts     # Pre/post-request scripts, dependent request chains
│   │   │   ├── oauth2.ts               # OAuth 2.0: PKCE, token exchange, callback server, refresh
│   │   │   ├── code-generator.ts       # Code snippet generation (9 languages)
│   │   │   ├── insomnia-import.ts      # Import Insomnia v4 collections/environments
│   │   │   ├── mcp-client.ts           # MCP SDK client: connect/disconnect, tool/resource/prompt calls, traffic log, {{variable}} substitution at connect time
│   │   │   ├── session-log.ts          # In-memory ring buffer, push to renderer
│   │   │   ├── yaml-serializer.ts      # Collection ↔ YAML directory serialization/import
│   │   │   ├── tls-options.ts             # Shared TLS + proxy helper: cert loading, ProxyAgent, no_proxy bypass
│   │   │   ├── fetch-error.ts            # Shared formatFetchError (SSL, DNS, timeout, proxy, etc.)
│   │   │   ├── sensitive-data-scanner.ts # Scan/sanitize sensitive data in requests, variables & MCP servers
│   │   │   ├── sse-parser.ts           # Stateful SSE text parser (spec-compliant, handles partial chunks)
│   │   │   ├── openapi-export.ts     # OpenAPI 3.0.3 YAML export from collection (paths, tags, auth, body)
│   │   │   ├── postman-export.ts      # Postman Collection v2.1 export from collection (folders→item groups, auth, body, variables)
│   │   │   ├── data-export-import.ts  # Export/import collections, environments, MCP servers, config
│   │   │   ├── openapi-import.ts     # Import OpenAPI 3.x/Swagger 2.x specs (JSON/YAML) as collections
│   │   │   ├── postman-import.ts      # Import Postman collections/environments (3 formats)
│   │   │   ├── mcp-yaml-serializer.ts # MCP server ↔ YAML directory serialization/import
│   │   │   ├── websocket-client.ts   # WebSocket client: connect/disconnect/send, {{variable}} substitution, push events to renderer
│   │   │   ├── assertion-evaluator.ts # Pure function: evaluateAssertions(assertions, response) → AssertionResult[]
│   │   │   ├── collection-runner.ts  # Sequential collection execution with progress push events
│   │   │   ├── cookie-jar.ts        # In-memory cookie store: RFC 6265 domain/path/secure matching
│   │   │   ├── graphql-subscription.ts # graphql-ws protocol client over raw WebSocket
│   │   │   ├── updater.ts            # electron-updater: init, check, quit-and-install, install-source detection
│   │   │   └── agent-socket/           # Local CLI / MCP RPC server (Unix socket / named pipe)
│   │   │       ├── index.ts          # start(), stop(), socket path resolution, lifecycle
│   │   │       ├── auth.ts           # 32-byte token, dotfile at ~/.vaxtly/cli.json (0600), verifyToken
│   │   │       ├── protocol.ts       # NDJSON framing, JSON-RPC 2.0 envelopes, LineBuffer, ERR codes
│   │   │       ├── router.ts         # registerMethod / dispatch / HandlerError; reads token from envelope (req.auth)
│   │   │       ├── notifier.ts        # broadcasts agent:data-changed push after a write (live UI refresh)
│   │   │       └── methods/
│   │   │           ├── _resolvers.ts        # resolveWorkspaceId / resolveCollectionId / resolveFolderId / resolveParentEnvId
│   │   │           ├── _redact.ts           # redactAuthJson + redactVariablesJson — unconditional, used by every get.*
│   │   │           ├── ping.ts
│   │   │           ├── upsert-collection.ts / upsert-folder.ts / upsert-request.ts / upsert-env.ts
│   │   │           ├── upsert-env-variable.ts  # Single-var safe path (no whole-array replace)
│   │   │           ├── list-{workspaces,collections,folders,requests,envs}.ts # Slim navigation shapes
│   │   │           └── get-{collection,folder,request,env}.ts # Full entity, sensitive fields redacted
│   │   ├── vault/
│   │   │   ├── secrets-provider.interface.ts      # SecretsProvider interface
│   │   │   ├── hashicorp-vault-provider.ts        # HashiCorp Vault KV v2 provider
│   │   │   ├── aws-secrets-manager-provider.ts    # AWS Secrets Manager provider
│   │   │   └── vault-sync-service.ts              # Vault sync: fetch/push vars, pullAll, migrate
│   │   └── sync/
│   │       ├── git-provider.interface.ts # GitProvider interface (list, get, commit, delete)
│   │       ├── github-provider.ts      # GitHub Git Data API provider
│   │       ├── gitlab-provider.ts      # GitLab Repository API v4 provider
│   │       └── remote-sync-service.ts  # 3-way merge, pull/push, conflict detection/resolution
│   └── renderer/
│       ├── index.html
│       ├── main.ts                     # Svelte mount point
│       ├── App.svelte                  # Root: sidebar + tabs + content + session persistence + auto-reveal + default env + conflict/orphan queues + clipboard cURL detection
│       ├── env.d.ts                    # window.api type declaration
│       ├── styles/app.css              # Tailwind + theme + scrollbars + CodeMirror
│       ├── lib/
│       │   ├── types.ts                # Re-exports from @shared
│       │   ├── ipc.ts                  # `export const api = window.api`
│       │   ├── stores/
│       │   │   ├── app.svelte.ts       # Tabs, sidebar, workspace state, settings modal
│       │   │   ├── collections.svelte.ts # Tree, CRUD, expand/collapse
│       │   │   ├── environments.svelte.ts # Environment list, activation
│       │   │   ├── mcp.svelte.ts       # MCP servers, connection states, traffic, notifications
│       │   │   ├── settings.svelte.ts  # App settings with typed keys + IPC persistence
│       │   │   ├── websocket.svelte.ts # WebSocket connection states + message logs
│       │   │   ├── graphql.svelte.ts   # GraphQL schema cache (introspection results per URL)
│       │   │   ├── toasts.svelte.ts   # Toast notifications for vault/git failures
│       │   │   └── drag.svelte.ts      # Drag-and-drop state for sidebar items
│       │   └── utils/
│       │       ├── http-colors.ts      # getMethodColor(), getStatusColor() → CSS variable strings
│       │       ├── formatters.ts       # formatSize, formatTime, detectLanguage, formatBody
│       │       ├── bulk-edit.ts        # Bulk-edit serialize/parse for key-value and form-data entries
│       │       ├── syntax-theme.ts    # Custom CodeMirror syntax highlight styles (dark + light)
│       │       └── variable-highlight.ts # CodeMirror {{var}} decoration + hover tooltip
│       └── components/
│           ├── CodeEditor.svelte       # CodeMirror 6 wrapper + optional variable highlight
│           ├── layout/
│           │   ├── Sidebar.svelte      # Mode selector dropdown (Collections/Environments/MCP) + search + tree + footer toolbar
│           │   ├── TabBar.svelte       # Horizontal tabs + env icon for environment tabs + double-click empty space opens draft
│           │   └── SystemLog.svelte    # Collapsible bottom panel: session logs + expandable HTTP detail
│           ├── sidebar/
│           │   ├── CollectionTree.svelte # Recursive tree with search filter
│           │   ├── CollectionItem.svelte # Expand/collapse, rename, sync, drag-drop target + auto-sync on move + gated delete for synced collections
│           │   ├── FolderItem.svelte    # Same pattern, self-recursive, drag-drop target + auto-sync on move
│           │   ├── RequestItem.svelte   # Method badge, active state, draggable
│           │   ├── EnvironmentList.svelte # Env list + active toggle + context menu (renders parent envs with indented children)
│           │   ├── McpServerList.svelte   # MCP server list with status dots + sync indicators + context menu (connect, edit, sync toggle, push)
│           │   └── WorkspaceSwitcher.svelte # Dropdown workspace selector + rename/delete/create
│           ├── mcp/
│           │   ├── McpInspector.svelte    # Split-panel: left (Tools/Resources/Prompts) + resizable divider + right (Response/Traffic/Notifications)
│           │   ├── McpServerForm.svelte   # Server config form (transport, command/URL, env vars, headers) + {{variable}} highlighting via VarInput
│           │   ├── McpJsonSchemaForm.svelte # Dynamic JSON Schema form for tool args
│           │   ├── McpToolsPane.svelte    # Tool list + call (emits results via callback)
│           │   ├── McpResourcesPane.svelte # Resource list + read (emits results via callback)
│           │   ├── McpPromptsPane.svelte  # Prompt list + get with arguments (emits results via callback)
│           │   ├── McpResponsePane.svelte # Response display: tool/resource/prompt results, loading, errors
│           │   ├── McpTrafficPane.svelte  # JSON-RPC traffic log
│           │   └── McpNotificationsPane.svelte # Server notifications log
│           ├── websocket/
│           │   ├── WsInspector.svelte   # Top-level WS view: connection bar + status + messages/headers sub-tabs
│           │   ├── WsConnectionBar.svelte # VarInput URL + protocol badge + Connect/Disconnect + Save
│           │   ├── WsMessageLog.svelte  # Scrollable message list with direction arrows, auto-scroll, CodeEditor for JSON
│           │   └── WsMessageComposer.svelte # Text/JSON input with CodeEditor for JSON mode, Enter to send
│           ├── request/
│           │   ├── RequestBuilder.svelte # Container: URL + sub-tabs + response split + cURL paste import
│           │   ├── UrlBar.svelte        # Method select + URL input + Send/Cancel + cURL paste detection
│           │   ├── ParamsEditor.svelte   # Query params ↔ URL sync
│           │   ├── HeadersEditor.svelte  # Headers editor (generated + user headers via KeyValueEditor)
│           │   ├── BodyEditor.svelte     # 7 body types: none/json/xml/form-data/urlencoded/raw/graphql
│           │   ├── AuthEditor.svelte     # 6 auth types: inherit/none/bearer/basic/api-key/oauth2 (showInherit prop controls inherit visibility)
│           │   ├── ScriptsEditor.svelte  # Pre-request + post-response script config (skip_if_valid toggle, set_token_expiry action)
│           │   └── TestsEditor.svelte    # Response assertions editor (status/header/json_path/response_time)
│           ├── container/
│           │   └── ContainerEditor.svelte # Collection/folder settings tab: Auth + Environments + Scripts + Variables (collection only). Saves via IPC update.
│           ├── environment/
│           │   └── EnvironmentEditor.svelte # Name, active toggle, variables, Save button, vault sync (toggle clears variables in both directions). Parents show "Used by" pills linking to children; children show an "Inherits from" picker + "Inherited from {parent}" read-only table with per-row Override action.
│           ├── response/
│           │   ├── ResponseViewer.svelte  # Status bar + Body/Headers/Cookies/Preview/Events/Tests tabs + SSE streaming + GraphQL subscription UI
│           │   ├── ResponseBody.svelte    # Read-only CodeMirror, auto-detect language, streaming body support
│           │   ├── ResponseHeaders.svelte # Key-value list
│           │   ├── ResponseCookies.svelte # Cookie cards with attributes
│           │   ├── SSEEventsTab.svelte    # SSE events debug table with auto-scroll
│           │   ├── AssertionResultsTab.svelte # Test assertion results table with pass/fail summary
│           │   ├── GqlSubscriptionEventsTab.svelte # GraphQL subscription events display with auto-scroll
│           │   └── HtmlPreview.svelte     # Sandboxed iframe (blob: URL, empty sandbox) HTML response preview
│           ├── settings/
│           │   ├── SettingsModal.svelte   # 4-tab bespoke modal (General/Data/Remote/Vault)
│           │   ├── GeneralTab.svelte      # Layout, timeout, SSL, redirects, proxy, certificates, about
│           │   ├── DataTab.svelte         # Export (type pills: all/collections/environments/mcp/config) + Import (Vaxtly/Postman/Insomnia)
│           │   ├── RemoteSyncTab.svelte   # Git provider config, test/pull/push (conflicts handled by centralized ConflictModal in App.svelte)
│           │   └── VaultTab.svelte        # Vault URL, auth, namespace, actions
│           ├── modals/
│           │   ├── CodeSnippetModal.svelte # Language tabs + generated code + copy
│           │   ├── CollectionPickerModal.svelte # Save draft to collection: search + create new + pick existing
│           │   ├── ConflictModal.svelte    # Sync conflict resolution with local/remote change details
│           │   ├── DeleteSyncedModal.svelte # Delete synced collection: local-only vs everywhere (remote)
│           │   ├── OrphanedCollectionModal.svelte # Orphaned collection: delete locally vs keep unsynced
│           │   ├── SensitiveDataModal.svelte # Sensitive data findings before push
│           │   ├── EnvironmentAssociationModal.svelte # Env checkbox list + default star + reloads store on save
│           │   ├── CurlImportModal.svelte  # Clipboard cURL detection: preview + Import/Dismiss
│           │   ├── CollectionRunnerModal.svelte # Collection runner progress + results table
│           │   ├── CookieJarModal.svelte  # Cookie jar viewer grouped by domain
│           │   └── WelcomeGuide.svelte    # 5-step onboarding modal
│           ├── help/
│           │   └── UserManual.svelte     # Comprehensive in-app user manual (F1 shortcut)
│           └── shared/
│               ├── KeyValueEditor.svelte  # Reusable checkbox + key + value + delete rows + bulk edit mode + "auto" badge for generated entries
│               ├── ContextMenu.svelte     # Right-click menu with position correction, ARIA roles + keyboard nav
│               ├── Modal.svelte           # Generic modal with backdrop + Escape + focus trap + focus restore
│               ├── Toggle.svelte          # Pill-shaped sliding switch (settings)
│               ├── Checkbox.svelte        # Square checkbox with checkmark animation
│               └── ToastContainer.svelte  # Fixed bottom-right toast notifications (vault/git failures)
├── tests/
│   ├── unit/
│   │   ├── repositories.test.ts        # 32 tests: all repos + encryption + workspace settings
│   │   ├── variable-substitution.test.ts # 20 tests: variable resolution + vault-synced cache reads
│   │   ├── script-execution.test.ts    # 43 tests: extractValue + extractJsonPath + executePostResponseScripts + vault mirror + graphql envelope
│   │   ├── code-generator.test.ts      # 32 tests: 9 languages + all auth/body types + graphql
│   │   ├── oauth2.test.ts             # 17 tests: PKCE, token expiry, mocked token exchange
│   │   ├── insomnia-import.test.ts    # 14 tests: workspace/folder/request/env import
│   │   ├── sensitive-data-scanner.test.ts # 34 tests: scan + sanitize + api-key + urlencoded + MCP server scan/sanitize
│   │   ├── yaml-serializer.test.ts     # 14 tests: serialize + import + auth/scripts + sanitize + auth decryption regression
│   │   ├── remote-sync.test.ts         # 19 tests: file state + isConfigured + getProvider
│   │   ├── sync-handlers.test.ts      # 32 tests: IPC handler logic + event.sender.send conflict push
│   │   ├── sync-service-logging.test.ts # 12 tests: pull/push logging, force-pull, conflict codes, dirty marking
│   │   ├── github-provider.test.ts    # 15 tests: GitHub Git Data API + Contents API mocked
│   │   ├── gitlab-provider.test.ts    # 16 tests: GitLab Repository API v4 mocked
│   │   ├── vault-sync.test.ts          # 17 tests: buildPath + isConfigured + resetProvider + in-memory cache
│   │   ├── vault-e2e.test.ts          # 14 tests: end-to-end vault in-memory flows (fresh install, auto-sync, cold cache, scripts)
│   │   ├── vault-handlers.test.ts     # 20 tests: vault IPC handlers + cache-first push
│   │   ├── hashicorp-vault-provider.test.ts # 17 tests: KV v2/v1, AppRole auth, namespace, SSL bypass
│   │   ├── aws-secrets-manager-provider.test.ts # 17 tests: CRUD, pagination, credential resolution
│   │   ├── aws-localstack.test.ts        # 5 tests: real CRUD against LocalStack (auto-skips when unavailable)
│   │   ├── openapi-export.test.ts      # 23 tests: OpenAPI 3.0.3 YAML export (paths, tags, auth, body, params, security schemes)
│   │   ├── postman-export.test.ts      # 11 tests: Postman v2.1 export (envelope, headers/query, nested folders, body types, auth, variables)
│   │   ├── openapi-import.test.ts      # 26 tests: OpenAPI 3.x import (JSON/YAML, paths, tags→folders, auth, body types)
│   │   ├── data-export-import.test.ts  # 15 tests: export + import + nested + workspace
│   │   ├── postman-import.test.ts      # 14 tests: 3 formats + form-data + URL objects + XML
│   │   ├── mcp-servers-repository.test.ts # MCP server CRUD, cascade, reorder
│   │   ├── mcp-client.test.ts          # 15 tests: MCP client lifecycle, traffic log, variable substitution, mocked SDK
│   │   ├── mcp-sync.test.ts            # 5 tests: sync field defaults, markDirty, findDirtyOrNew, findSyncEnabled
│   │   ├── mcp-yaml-serializer.test.ts # 11 tests: serialize/import round-trip, manifest, sanitize, upsert
│   │   ├── bulk-edit.test.ts            # 23 tests: entriesToBulk, bulkToEntries, formDataToBulk, bulkToFormData
│   │   ├── encryption.test.ts          # 6 tests: round-trip, random IV, wrong key
│   │   ├── tls-options.test.ts         # 36 tests: TLS config, proxy agent, shouldProxy, cert loading
│   │   ├── fetch-error.test.ts         # 17 tests: all error branches (SSL, DNS, timeout, proxy, etc.)
│   │   ├── session-log.test.ts         # 6 tests: ring buffer, categories, copy safety
│   │   ├── proxy-handler.test.ts       # 22 tests: HTTP proxy dispatch, auth, body, scripts
│   │   ├── proxy-helpers.test.ts       # 8 tests: parseCookies + setDefaultHeader + deleteHeader
│   │   ├── sse-parser.test.ts          # 22 tests: SSE parsing, multi-line, partial chunks, OpenAI/Anthropic formats
│   │   ├── curl-parser.test.ts         # 36 tests: cURL parsing, headers, body types, auth, query params, quoting
│   │   ├── assertion-evaluator.test.ts # 33 tests: all assertion types/operators, disabled assertions, edge cases
│   │   ├── cookie-jar.test.ts          # 24 tests: capture, domain/path/secure matching, expiry, RFC 6265 compliance
│   │   ├── external-keys.test.ts       # 17 tests: external_key round-trip on all 4 entities, partial unique index, scope isolation
│   │   ├── agent-socket.test.ts        # 5 tests: real socket + NDJSON framing + token rotation, ping
│   │   ├── agent-socket-upsert.test.ts # 27 tests: all upsert methods + upsert.env_variable + adopt-by-id + auth gate
│   │   ├── agent-socket-read.test.ts   # 11 tests: list/get + redaction tripwires for every sensitive field
│   │   └── cli-smoke.test.ts           # 6 tests: compiled CLI binary — argv dispatch, exit codes, help
│   └── e2e/
│       ├── fixtures/
│       │   ├── electron-app.ts         # Shared fixture: temp userData, app launch, cleanup
│       │   └── test-server.ts          # Local HTTP echo server (127.0.0.1:0)
│       ├── smoke.spec.ts              # 3 tests: boot, sidebar, empty state
│       ├── keyboard-shortcuts.spec.ts # 4 tests: Ctrl+N/W/B/,
│       ├── collection-crud.spec.ts    # 4 tests: create/rename/add-request/delete
│       ├── send-request.spec.ts       # 6 tests: GET, POST+JSON, error, 404, 500, custom headers
│       ├── settings.spec.ts           # 3 tests: tabs, Escape, close button
│       ├── environment-vars.spec.ts   # 2 tests: create env+var, use {{var}}
│       ├── session-persistence.spec.ts # 1 test: tabs survive restart
│       └── draft-requests.spec.ts    # 6 tests: draft lifecycle, send, save, persist, double-click
├── cli/                                # Bundled `vaxtly` CLI + MCP wrapper — talks to the running app via agent-socket
│   ├── package.json                   # bin: { vaxtly: dist/index.js }, private, no own runtime deps
│   ├── tsconfig.json                  # CommonJS target; dist/ shipped via electron-builder extraResources
│   └── src/
│       ├── index.ts                   # Argv dispatcher: upsert/list/get/ping/install-cli/mcp/help/guide
│       ├── argparse.ts                # Hand-rolled long-flag parser (repeatable flags, --key=val, --flag '')
│       ├── client.ts                  # JSON-RPC 2.0 client over Unix socket / named pipe (auth in envelope)
│       ├── config.ts                  # Loads ~/.vaxtly/cli.json; honors VAXTLY_TEST_CLI_CONFIG_DIR
│       ├── exit.ts                    # EXIT codes (0/1/2/3/4/5) + exitCodeForError(rpcCode)
│       ├── help.ts                    # HELP_TOP + per-verb help strings (vaxtly <verb> --help)
│       ├── guide.ts                   # Long-form agent-facing guide (printed by `vaxtly guide`)
│       ├── mcp/server.ts              # MCP stdio server — 15 tools mirroring upsert/list/get verbs, readOnlyHint on reads
│       └── commands/
│           ├── upsert-collection.ts / upsert-folder.ts / upsert-request.ts / upsert-env.ts / upsert-env-var.ts
│           ├── list.ts / get.ts       # Subcommand dispatchers
│           ├── ping.ts
│           └── install-cli.ts         # Symlink dist/index.js into ~/.local/bin/vaxtly (POSIX MVP)
├── electron.vite.config.ts             # 3-target build (main, preload, renderer)
├── playwright.config.ts                # E2E config: workers:1, timeout:30s
├── vitest.config.ts                    # @shared alias, globals: true, v8 coverage
├── tsconfig.json                       # Project references
├── tsconfig.node.json                  # main + shared
├── tsconfig.web.json                   # renderer + shared
├── svelte.config.js                    # vitePreprocess only
├── package.json
└── tailwind.config.js                  # (not present — Tailwind v4 uses CSS @theme)
```

---

## Database Schema

SQLite WAL mode. All primary keys are UUID TEXT. Foreign keys enforced via `PRAGMA foreign_keys = ON`.

### Entity Relationship Diagram

```
workspaces 1──N collections
workspaces 1──N environments
workspaces 1──N mcp_servers
collections 1──N folders
requests 1──N websocket_messages (ON DELETE CASCADE)
collections 1──N requests
folders 1──N folders (self-referential, max ~3 levels)
folders 1──N requests (ON DELETE SET NULL)
```

### Tables

#### `workspaces`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| name | TEXT NOT NULL | | |
| description | TEXT | NULL | |
| order | INTEGER | 0 | |
| settings | TEXT | NULL | JSON |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

#### `collections`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| workspace_id | TEXT | NULL | FK → workspaces ON DELETE CASCADE |
| name | TEXT NOT NULL | | |
| description | TEXT | NULL | |
| order | INTEGER | 0 | |
| variables | TEXT | NULL | JSON `Record<string,string>` — collection-level vars |
| remote_sha | TEXT | NULL | Git blob SHA for sync |
| remote_synced_at | TEXT | NULL | |
| is_dirty | INTEGER | 0 | 1 = needs push |
| sync_enabled | INTEGER | 0 | |
| environment_ids | TEXT | NULL | JSON `string[]` — associated envs |
| default_environment_id | TEXT | NULL | |
| auth | TEXT | NULL | JSON `AuthConfig` — collection-level auth for inheritance. Sensitive fields encrypted with `enc:` prefix |
| scripts | TEXT | NULL | JSON `ScriptsConfig` — collection-level pre/post scripts with smart token caching |
| file_shas | TEXT | NULL | JSON `{path: {content_hash, remote_sha, commit_sha}}` |
| external_key | TEXT | NULL | Caller-chosen stable id for idempotent upserts via the agent socket (migration 009). Partial unique index `(workspace_id, external_key) WHERE external_key IS NOT NULL` — multiple NULLs allowed, uniqueness enforced per workspace |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

#### `folders`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| collection_id | TEXT NOT NULL | | FK → collections ON DELETE CASCADE |
| parent_id | TEXT | NULL | FK → folders ON DELETE CASCADE (self-ref) |
| name | TEXT NOT NULL | | |
| order | INTEGER | 0 | Scoped to (collection_id, parent_id) |
| environment_ids | TEXT | NULL | JSON |
| default_environment_id | TEXT | NULL | |
| auth | TEXT | NULL | JSON `AuthConfig` — folder-level auth for inheritance. Sensitive fields encrypted with `enc:` prefix |
| scripts | TEXT | NULL | JSON `ScriptsConfig` — folder-level pre/post scripts with smart token caching |
| external_key | TEXT | NULL | Agent-socket idempotency handle (migration 009). Partial unique index scoped to `collection_id` — folder keys must be unique within a collection but can repeat across collections |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

#### `requests`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| collection_id | TEXT NOT NULL | | FK → collections ON DELETE CASCADE |
| folder_id | TEXT | NULL | FK → folders ON DELETE SET NULL |
| name | TEXT NOT NULL | | |
| url | TEXT | '' | |
| method | TEXT | 'GET' | |
| headers | TEXT | NULL | JSON `KeyValueEntry[]` |
| query_params | TEXT | NULL | JSON `KeyValueEntry[]` |
| body | TEXT | NULL | String or JSON (form-data: serialized `FormDataEntry[]`) |
| body_type | TEXT | 'json' | none\|json\|xml\|form-data\|urlencoded\|raw\|graphql |
| auth | TEXT | NULL | JSON `AuthConfig` — sensitive fields encrypted with `enc:` prefix |
| scripts | TEXT | NULL | JSON `ScriptsConfig` |
| order | INTEGER | 0 | |
| external_key | TEXT | NULL | Agent-socket idempotency handle (migration 009). Partial unique index scoped to `collection_id` (NOT `folder_id`) — so a request can be moved between folders within the same collection without breaking idempotency |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

#### `environments`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| workspace_id | TEXT | NULL | FK → workspaces ON DELETE CASCADE |
| parent_id | TEXT | NULL | FK → environments ON DELETE SET NULL (migration 008). When set, this env inherits variables from its parent. Depth capped at 2 (children cannot themselves be parents); enforced in `repositories/environments.ts#validateParent`. Indexed. |
| name | TEXT NOT NULL | | |
| variables | TEXT NOT NULL | '[]' | JSON `EnvironmentVariable[]` — values encrypted with `enc:` prefix; always `'[]'` for vault-synced envs (secrets held in-memory only) |
| is_active | INTEGER | 0 | Only 1 active per workspace (enforced in code) |
| order | INTEGER | 0 | Scoped per (workspace_id, parent_id) sibling group |
| vault_synced | INTEGER | 0 | CHECK: when 1, `variables` must be `'[]'` |
| vault_path | TEXT | NULL | |
| external_key | TEXT | NULL | Agent-socket idempotency handle (migration 009). Partial unique index scoped to `workspace_id` (NOT `parent_id`) — so an env can be re-parented within a workspace without breaking idempotency |
| created_at | TEXT | datetime('now') | Indexed (migration 005) |
| updated_at | TEXT | datetime('now') | Indexed (migration 005) |

**Inheritance semantics.** When an env has a `parent_id`, `getResolvedVariables` walks the chain `parent → child` and merges enabled entries; child keys override parent keys, then collection variables win last. Disabled child entries are ignored (parent value applies). Mirror-back from scripts (`script-execution.ts#mirrorToActiveEnvironment`) walks `active → parent` and writes to the first env that already defines the key, with no auto-create. For vault-synced parents, `vault-sync-service.ts#ensureLoadedChain` primes every vault-synced env in the chain on activation and surfaces per-node failures.

#### `app_settings`
| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | |
| value | TEXT NOT NULL | Sensitive keys (`vault.token`, `vault.role_id`, `vault.secret_id`, `vault.aws_access_key_id`, `vault.aws_secret_access_key`, `sync.token`, `tls.client_key_passphrase`, `proxy.username`, `proxy.password`) stored as AES-256-GCM encrypted base64 |

#### `window_state`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | 1 | Singleton (CHECK id=1) |
| x | INTEGER | NULL | |
| y | INTEGER | NULL | |
| width | INTEGER | 1200 | |
| height | INTEGER | 800 | |
| is_maximized | INTEGER | 0 | |

#### `mcp_servers`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| workspace_id | TEXT NOT NULL | | FK → workspaces ON DELETE CASCADE |
| name | TEXT NOT NULL | | |
| transport_type | TEXT NOT NULL | 'stdio' | 'stdio' \| 'streamable-http' \| 'sse' |
| command | TEXT | NULL | stdio only |
| args | TEXT | NULL | JSON `string[]` — stdio only |
| env | TEXT | NULL | JSON `Record<string, string>` — stdio only |
| cwd | TEXT | NULL | stdio only |
| url | TEXT | NULL | HTTP/SSE only |
| headers | TEXT | NULL | JSON `Record<string, string>` — HTTP/SSE only |
| order | INTEGER | 0 | |
| sync_enabled | INTEGER | 0 | 1 = sync to remote |
| is_dirty | INTEGER | 0 | 1 = needs push |
| remote_sha | TEXT | NULL | Git blob SHA for sync |
| remote_synced_at | TEXT | NULL | |
| file_shas | TEXT | NULL | JSON `{path: {content_hash, remote_sha, commit_sha}}` |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

#### `websocket_messages`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | uuid | |
| connection_id | TEXT NOT NULL | | FK → requests ON DELETE CASCADE |
| direction | TEXT NOT NULL | | 'sent' \| 'received' |
| data | TEXT NOT NULL | | Message payload |
| timestamp | TEXT | datetime('now') | |
| size | INTEGER | 0 | Byte length of data |

Index: `idx_ws_messages_connection` on `connection_id`. Trimmed to `WS_MESSAGE_LOG_MAX` (500) per connection.

**WebSocket requests**: Stored in the `requests` table with `method = 'WEBSOCKET'`. This reuses collections, folders, drag-and-drop, and sync for free.

---

## IPC Architecture

Pattern: `ipcMain.handle('domain:action', handler)` in main, `ipcRenderer.invoke('domain:action', ...args)` in preload.

### Full Channel Map

| Channel | Handler File | Repository Method | Preload API |
|---------|-------------|-------------------|-------------|
| `workspaces:list` | ipc/workspaces.ts | `findAll()` | `api.workspaces.list()` |
| `workspaces:create` | ipc/workspaces.ts | `create(data)` | `api.workspaces.create(data)` |
| `workspaces:update` | ipc/workspaces.ts | `update(id, data)` | `api.workspaces.update(id, data)` |
| `workspaces:delete` | ipc/workspaces.ts | `remove(id)` | `api.workspaces.delete(id)` |
| `collections:list` | ipc/collections.ts | `findByWorkspace(wsId)` | `api.collections.list(wsId?)` |
| `collections:get` | ipc/collections.ts | `findById(id)` | `api.collections.get(id)` |
| `collections:create` | ipc/collections.ts | `create(data)` | `api.collections.create(data)` |
| `collections:update` | ipc/collections.ts | `update(id, data)` | `api.collections.update(id, data)` |
| `collections:delete` | ipc/collections.ts | `remove(id)` | `api.collections.delete(id)` |
| `collections:reorder` | ipc/collections.ts | `reorder(ids)` | `api.collections.reorder(ids)` |
| `folders:list` | ipc/folders.ts | `findByCollection(colId)` | `api.folders.list(colId)` |
| `folders:get` | ipc/folders.ts | `findById(id)` | `api.folders.get(id)` |
| `folders:create` | ipc/folders.ts | `create(data)` | `api.folders.create(data)` |
| `folders:update` | ipc/folders.ts | `update(id, data)` | `api.folders.update(id, data)` |
| `folders:delete` | ipc/folders.ts | `remove(id)` | `api.folders.delete(id)` |
| `folders:reorder` | ipc/folders.ts | `reorder(ids)` | `api.folders.reorder(ids)` |
| `requests:list` | ipc/requests.ts | `findByCollection(colId)` | `api.requests.list(colId)` |
| `requests:get` | ipc/requests.ts | `findById(id)` | `api.requests.get(id)` |
| `requests:create` | ipc/requests.ts | `create(data)` | `api.requests.create(data)` |
| `requests:update` | ipc/requests.ts | `update(id, data)` | `api.requests.update(id, data)` |
| `requests:delete` | ipc/requests.ts | `remove(id)` | `api.requests.delete(id)` |
| `requests:move` | ipc/requests.ts | `move(id, folderId, colId?)` | `api.requests.move(...)` |
| `requests:reorder` | ipc/requests.ts | `reorder(ids)` | `api.requests.reorder(ids)` |
| `environments:list` | ipc/environments.ts | `findByWorkspace(wsId)` | `api.environments.list(wsId?)` |
| `environments:get` | ipc/environments.ts | `findById(id)` | `api.environments.get(id)` |
| `environments:create` | ipc/environments.ts | `create(data)` | `api.environments.create(data)` |
| `environments:update` | ipc/environments.ts | `update(id, data)` | `api.environments.update(id, data)` |
| `environments:delete` | ipc/environments.ts | `remove(id)` | `api.environments.delete(id)` |
| `environments:reorder` | ipc/environments.ts | `reorder(ids)` | `api.environments.reorder(ids)` |
| `environments:activate` | ipc/environments.ts | `activate(id, wsId?)` + chain-aware vault pre-fetch (`ensureLoadedChain`) | `api.environments.activate(id, wsId?)` → `{ vaultFailed, failures: { envId, name, reason }[] }?` |
| `environments:deactivate` | ipc/environments.ts | `deactivate(id)` | `api.environments.deactivate(id)` |
| `proxy:send` | ipc/proxy.ts | native fetch + var substitution (auto-detects SSE) | `api.proxy.send(reqId, config)` |
| `proxy:cancel` | ipc/proxy.ts | AbortController | `api.proxy.cancel(reqId)` |
| `proxy:pick-file` | ipc/proxy.ts | dialog.showOpenDialog | `api.proxy.pickFile()` |
| `proxy:pick-cert-file` | ipc/proxy.ts | dialog.showOpenDialog (PEM/CRT/KEY) | `api.proxy.pickCertFile()` |
| `sse:stream-start` | — (main→renderer push) | — | `api.on.sseStreamStart(cb)` |
| `sse:stream-chunk` | — (main→renderer push) | — | `api.on.sseStreamChunk(cb)` |
| `sse:stream-end` | — (main→renderer push) | — | `api.on.sseStreamEnd(cb)` |
| `variables:resolve` | ipc/variables.ts | `ensureLoadedChain()` + `getResolvedVariables()` (walks env parent chain) | `api.variables.resolve(wsId?, colId?)` |
| `variables:resolve-with-source` | ipc/variables.ts | `ensureLoadedChain()` + `getResolvedVariablesWithSource()` — per-link source labels | `api.variables.resolveWithSource(wsId?, colId?)` |
| `code:generate` | ipc/code-generator.ts | `generateCode(lang, data, ...)` | `api.codeGenerator.generate(...)` |
| `graphql:introspect` | ipc/graphql.ts | `undiciFetch()` + `getIntrospectionQuery()` | `api.graphql.introspect(config)` |
| `log:list` | ipc/session-log.ts | `getLogs()` | `api.log.list()` |
| `log:clear` | ipc/session-log.ts | `clearLogs()` | `api.log.clear()` |
| `log:push` | — (main→renderer push) | — | `api.on.logPush(cb)` |
| `sync:test-connection` | ipc/sync.ts | `syncService.testConnection()` | `api.sync.testConnection()` |
| `sync:pull` | ipc/sync.ts | `syncService.pull(wsId?)` — pushes conflicts via `sync:conflict`, orphans via `sync:orphaned-collections` | `api.sync.pull(wsId?)` |
| `sync:push-collection` | ipc/sync.ts | `syncService.pushCollection()` — pushes conflicts via `sync:conflict` | `api.sync.pushCollection(id, sanitize?)` |
| `sync:push-all` | ipc/sync.ts | `syncService.pushAll(wsId?)` — pushes conflicts via `sync:conflict` | `api.sync.pushAll(wsId?)` |
| `sync:resolve-conflict` | ipc/sync.ts | `syncService.forceKeep{Local,Remote}()` | `api.sync.resolveConflict(id, res, wsId?)` |
| `sync:delete-remote` | ipc/sync.ts | `syncService.deleteRemoteCollection()` | `api.sync.deleteRemote(id)` |
| `sync:scan-sensitive` | ipc/sync.ts | `scanCollection(reqs, vars)` | `api.sync.scanSensitive(id)` |
| `sync:resolve-orphan` | ipc/sync.ts | Delete or unlink-sync orphaned collection | `api.sync.resolveOrphan(id, res)` |
| `sync:conflict` | — (main→renderer push) | — | `api.on.syncConflict(cb)` |
| `sync:orphaned-collections` | — (main→renderer push) | — | `api.on.syncOrphanedCollections(cb)` |
| `sync:push-request` | ipc/sync.ts | `syncService.pushSingleRequest()` | `api.sync.pushRequest(colId, reqId, sanitize?)` |
| `sync:push-mcp-server` | ipc/sync.ts | `syncService.pushMcpServer()` | `api.sync.pushMcpServer(serverId, sanitize?, wsId?)` |
| `sync:pull-mcp-server` | ipc/sync.ts | `syncService.pullSingleMcpServer()` | `api.sync.pullMcpServer(serverId, wsId?)` |
| `sync:scan-mcp-sensitive` | ipc/sync.ts | `scanMcpServer()` | `api.sync.scanMcpSensitive(serverId)` |
| `vault:test-connection` | ipc/vault.ts | `vaultService.testConnection()` | `api.vault.testConnection()` |
| `vault:pull` | ipc/vault.ts | `vaultService.pullAll()` | `api.vault.pull()` |
| `vault:push` | ipc/vault.ts | `vaultService.pushVariables()` | `api.vault.push(envId)` |
| `vault:pull-all` | ipc/vault.ts | `vaultService.pullAll(wsId?)` | `api.vault.pullAll(wsId?)` |
| `vault:fetch-variables` | ipc/vault.ts | `clearCache()` + `vaultService.fetchVariables(envId)` | `api.vault.fetchVariables(envId)` |
| `vault:get-cached-variables` | ipc/vault.ts | `vaultService.getCachedVariables(envId)` | `api.vault.getCachedVariables(envId)` |
| `vault:push-variables` | ipc/vault.ts | `vaultService.pushVariables(envId, vars)` | `api.vault.pushVariables(envId, vars)` |
| `vault:delete-secrets` | ipc/vault.ts | `vaultService.deleteSecrets(envId)` | `api.vault.deleteSecrets(envId)` |
| `vault:migrate` | ipc/vault.ts | `vaultService.migrateEnvironment(...)` | `api.vault.migrate(envId, old, new)` |
| `data:export` | ipc/data-import-export.ts | `dataService.export{All,Collections,Environments,McpServers,Config}()` | `api.data.export(type, wsId?)` |
| `data:export-mcp-server` | ipc/data-import-export.ts | `dataService.exportSingleMcpServer(id)` | `api.data.exportMcpServer(id)` |
| `data:export-openapi` | ipc/data-import-export.ts | `exportOpenAPI(collectionId)` → YAML string | `api.data.exportOpenAPI(id)` |
| `data:export-postman` | ipc/data-import-export.ts | `exportPostman(collectionId)` → Postman v2.1 doc | `api.data.exportPostman(id)` |
| `data:pick-and-read` | ipc/data-import-export.ts | `dialog.showOpenDialog()` + `readFileSync()` | `api.data.pickAndRead()` |
| `data:import` | ipc/data-import-export.ts | `dataService.importData(json, wsId?)` | `api.data.import(json, wsId?)` |
| `postman:import` | ipc/data-import-export.ts | `importPostman(json, wsId?)` | `api.data.importPostman(json, wsId?)` |
| `insomnia:import` | ipc/data-import-export.ts | `importInsomnia(json, wsId?)` | `api.data.importInsomnia(json, wsId?)` |
| `openapi:import` | ipc/data-import-export.ts | `importOpenAPI(input, wsId?)` | `api.data.importOpenAPI(input, wsId?)` |
| `oauth2:get-token` | ipc/oauth2.ts | `startAuthorizationFlow()` / `exchangeClientCredentials()` / `exchangePassword()` | `api.oauth2.getToken(reqId)` |
| `oauth2:refresh-token` | ipc/oauth2.ts | `refreshAccessToken(auth)` | `api.oauth2.refreshToken(reqId)` |
| `oauth2:clear-token` | ipc/oauth2.ts | clears token fields | `api.oauth2.clearToken(reqId)` |
| `settings:get` | ipc/settings.ts | `getSetting(key)` | `api.settings.get(key)` |
| `settings:set` | ipc/settings.ts | `setSetting(key, val)` | `api.settings.set(key, val)` |
| `settings:get-all` | ipc/settings.ts | `getAllSettings()` | `api.settings.getAll()` |
| `workspace-settings:get` | ipc/settings.ts | `getWorkspaceSetting(wsId, key)` | `api.workspaceSettings.get(wsId, key)` |
| `workspace-settings:set` | ipc/settings.ts | `setWorkspaceSetting(wsId, key, val)` | `api.workspaceSettings.set(wsId, key, val)` |
| `workspace-settings:get-all` | ipc/settings.ts | `getWorkspaceSettings(wsId)` | `api.workspaceSettings.getAll(wsId)` |
| `window:get-state` | ipc/settings.ts | `getWindowState()` | `api.window.getState()` |
| `window:save-state` | ipc/settings.ts | `saveWindowState(s)` | `api.window.saveState(s)` |

| `mcp:servers-list` | ipc/mcp.ts | `findByWorkspace(wsId)` | `api.mcp.listServers(wsId)` |
| `mcp:servers-create` | ipc/mcp.ts | `create(data)` | `api.mcp.createServer(data)` |
| `mcp:servers-update` | ipc/mcp.ts | `update(id, data)` | `api.mcp.updateServer(id, data)` |
| `mcp:servers-delete` | ipc/mcp.ts | `remove(id)` + disconnect | `api.mcp.deleteServer(id)` |
| `mcp:servers-reorder` | ipc/mcp.ts | `reorder(ids)` | `api.mcp.reorderServers(ids)` |
| `mcp:connect` | ipc/mcp.ts | `mcpClient.connect(server)` | `api.mcp.connect(serverId)` |
| `mcp:disconnect` | ipc/mcp.ts | `mcpClient.disconnect(serverId)` | `api.mcp.disconnect(serverId)` |
| `mcp:list-tools` | ipc/mcp.ts | `mcpClient.listTools(serverId)` | `api.mcp.listTools(serverId)` |
| `mcp:call-tool` | ipc/mcp.ts | `mcpClient.callTool(serverId, name, args)` | `api.mcp.callTool(serverId, name, args)` |
| `mcp:list-resources` | ipc/mcp.ts | `mcpClient.listResources(serverId)` | `api.mcp.listResources(serverId)` |
| `mcp:read-resource` | ipc/mcp.ts | `mcpClient.readResource(serverId, uri)` | `api.mcp.readResource(serverId, uri)` |
| `mcp:list-resource-templates` | ipc/mcp.ts | `mcpClient.listResourceTemplates(serverId)` | `api.mcp.listResourceTemplates(serverId)` |
| `mcp:list-prompts` | ipc/mcp.ts | `mcpClient.listPrompts(serverId)` | `api.mcp.listPrompts(serverId)` |
| `mcp:get-prompt` | ipc/mcp.ts | `mcpClient.getPrompt(serverId, name, args)` | `api.mcp.getPrompt(serverId, name, args)` |
| `mcp:traffic-list` | ipc/mcp.ts | `mcpClient.getTrafficLog(serverId)` | `api.mcp.trafficList(serverId)` |
| `mcp:traffic-clear` | ipc/mcp.ts | `mcpClient.clearTrafficLog(serverId)` | `api.mcp.trafficClear(serverId)` |
| `mcp:status-changed` | — (main→renderer push) | — | `api.on.mcpStatusChanged(cb)` |
| `mcp:notification` | — (main→renderer push) | — | `api.on.mcpNotification(cb)` |
| `mcp:traffic-push` | — (main→renderer push) | — | `api.on.mcpTrafficPush(cb)` |
| `mcp:tools-changed` | — (main→renderer push) | — | `api.on.mcpToolsChanged(cb)` |
| `mcp:resources-changed` | — (main→renderer push) | — | `api.on.mcpResourcesChanged(cb)` |
| `mcp:prompts-changed` | — (main→renderer push) | — | `api.on.mcpPromptsChanged(cb)` |
| `ws:connect` | ipc/websocket.ts | `wsClient.connect(id, config)` | `api.ws.connect(id, config)` |
| `ws:disconnect` | ipc/websocket.ts | `wsClient.disconnect(id)` | `api.ws.disconnect(id)` |
| `ws:send` | ipc/websocket.ts | `wsClient.sendMessage(id, data)` | `api.ws.send(id, data)` |
| `ws:messages-list` | ipc/websocket.ts | `wsMessagesRepo.findByConnection(id)` | `api.ws.messages.list(id)` |
| `ws:messages-clear` | ipc/websocket.ts | `wsMessagesRepo.clearByConnection(id)` | `api.ws.messages.clear(id)` |
| `ws:status-changed` | — (main→renderer push) | — | `api.on.wsStatusChanged(cb)` |
| `ws:message-received` | — (main→renderer push) | — | `api.on.wsMessageReceived(cb)` |
| `update:check` | ipc/updater.ts | `checkForUpdates()` | `api.updater.check()` |
| `update:install` | ipc/updater.ts | `quitAndInstall()` | `api.updater.install()` |
| `update:install-source` | ipc/updater.ts | `getInstallSource()` | `api.updater.installSource()` |
| `update:available` | — (main→renderer push) | — | `api.on.updateAvailable(cb)` |
| `update:progress` | — (main→renderer push) | — | `api.on.updateProgress(cb)` |
| `update:downloaded` | — (main→renderer push) | — | `api.on.updateDownloaded(cb)` |
| `update:error` | — (main→renderer push) | — | `api.on.updateError(cb)` |

| `runner:start` | ipc/collection-runner.ts | `startRun(colId, wsId)` | `api.runner.start(colId, wsId?)` |
| `runner:cancel` | ipc/collection-runner.ts | `cancelRun(runId)` | `api.runner.cancel(runId)` |
| `runner:started` | — (main→renderer push) | — | `api.on.runnerStarted(cb)` |
| `runner:progress` | — (main→renderer push) | — | `api.on.runnerProgress(cb)` |
| `runner:complete` | — (main→renderer push) | — | `api.on.runnerComplete(cb)` |
| `cookies:list` | ipc/cookies.ts | `listAll()` | `api.cookies.list()` |
| `cookies:clear` | ipc/cookies.ts | `clearAll()` | `api.cookies.clear()` |
| `cookies:delete` | ipc/cookies.ts | `deleteCookie(domain, name)` | `api.cookies.delete(domain, name)` |
| `gql-sub:subscribe` | ipc/graphql-subscription.ts | `subscribe(reqId, config)` | `api.gqlSub.subscribe(reqId, config)` |
| `gql-sub:unsubscribe` | ipc/graphql-subscription.ts | `unsubscribe(reqId)` | `api.gqlSub.unsubscribe(reqId)` |
| `gql-sub:status-changed` | — (main→renderer push) | — | `api.on.gqlSubStatusChanged(cb)` |
| `gql-sub:event` | — (main→renderer push) | — | `api.on.gqlSubEvent(cb)` |
| `clipboard:text` | — (main→renderer push on BrowserWindow focus) | — | `api.on.clipboardText(cb)` |
| `agent:data-changed` | — (main→renderer push after a CLI/MCP agent-socket upsert) | — | `api.on.agentDataChanged(cb)` |

**Menu channels** (main→renderer push via `IPC.*` constants, not request/response):
`menu:new-request`, `menu:save-request`, `menu:open-settings`, `menu:open-manual`, `menu:check-updates`

---

## Shared Types

### `models.ts`

```typescript
interface Workspace { id, name, description?, order, settings?, created_at, updated_at }
interface Collection { id, workspace_id?, name, description?, order, variables?, remote_sha?,
    remote_synced_at?, is_dirty, sync_enabled, environment_ids?, default_environment_id?,
    auth?, scripts?, file_shas?, external_key?, created_at, updated_at }
interface Folder { id, collection_id, parent_id?, name, order, environment_ids?,
    default_environment_id?, auth?, scripts?, external_key?, created_at, updated_at }
interface Request { id, collection_id, folder_id?, name, url, method, headers?, query_params?,
    body?, body_type, auth?, scripts?, order, external_key?, created_at, updated_at }
interface Environment { id, workspace_id?, parent_id?, name, variables (JSON string), is_active (0|1),
    order, vault_synced, vault_path?, external_key?, created_at, updated_at }
interface AppSetting { key, value }
interface WindowState { id?, x?, y?, width, height, is_maximized }
interface KeyValueEntry { key, value, description?, enabled, generated? }
interface AuthConfig { type: 'inherit'|'none'|'bearer'|'basic'|'api-key'|'oauth2', bearer_token?,
    basic_username?, basic_password?, api_key_header?, api_key_value?,
    oauth2_grant_type?, oauth2_access_token_url?, oauth2_authorization_url?,
    oauth2_client_id?, oauth2_client_secret?, oauth2_scope?, oauth2_username?,
    oauth2_password?, oauth2_redirect_url?, oauth2_pkce?, oauth2_audience?,
    oauth2_access_token?, oauth2_refresh_token?, oauth2_token_type?, oauth2_expires_at? }
interface ScriptsConfig { pre_request?: PreRequestScript | PreRequestScript[], post_response?: PostResponseScript[], assertions?: Assertion[] }
interface PreRequestScript { action: 'send_request', request_id, skip_if_valid?: { token_variable, expires_at_variable } }
interface PostResponseScript { action: 'set_variable' | 'set_token_expiry', source, target }
interface EnvironmentVariable { key, value, enabled }
type AssertionType = 'status' | 'header' | 'json_path' | 'response_time'
type AssertionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists' | 'less_than' | 'greater_than' | 'matches_regex'
interface Assertion { type, target, operator, expected, enabled }
interface AssertionResult { assertion, passed, actual, error? }
```

### `http.ts`

```typescript
type BodyType = 'none' | 'json' | 'xml' | 'form-data' | 'urlencoded' | 'raw' | 'graphql'
interface RequestConfig { method, url, headers, body?, bodyType?, formData?, timeout?,
    followRedirects?, verifySsl? }
interface FormDataEntry { key, value, type: 'text'|'file', enabled, filePath?, fileName? }
interface ResponseData { status, statusText, headers, body, size, timing, cookies, assertionResults? }
interface ResponseTiming { start, ttfb, total }
interface ResponseCookie { name, value, domain?, path?, expires?, httpOnly?, secure?, sameSite? }
```

### `mcp.ts`

```typescript
type McpTransportType = 'stdio' | 'streamable-http' | 'sse'
type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
interface McpServer { id, workspace_id, name, transport_type, command?, args?, env?, cwd?, url?, headers?, order, sync_enabled, is_dirty, remote_sha?, remote_synced_at?, file_shas?, created_at, updated_at }
interface McpServerState { serverId, status, error?, serverInfo?, tools[], resources[], resourceTemplates[], prompts[] }
interface McpTool { name, description?, inputSchema }
interface McpResource { uri, name, description?, mimeType? }
interface McpResourceTemplate { uriTemplate, name, description?, mimeType? }
interface McpPrompt { name, description?, arguments?: McpPromptArgument[] }
interface McpToolCallResult { content: McpContentBlock[], isError? }
interface McpResourceReadResult { contents: Array<{ uri, mimeType?, text?, blob? }> }
interface McpPromptGetResult { description?, messages: McpPromptMessage[] }
interface McpTrafficEntry { id, serverId, direction, method, params?, result?, error?, timestamp }
interface McpNotification { id, serverId, method, params?, timestamp }
```

### `websocket.ts`

```typescript
type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
interface WsConnectionConfig { url, headers?, protocols?, workspaceId?, collectionId? }
interface WsConnectionState { connectionId, status, connectedAt?, error?, messageCount }
interface WsMessage { id, connection_id, direction: 'sent'|'received', data, timestamp, size }
interface WsStatusChanged { connectionId, status, error? }
interface WsMessageReceived { connectionId, message: WsMessage }
```

### `runner.ts`

```typescript
interface RequestRunResult { requestId, requestName, method, url, status, statusText, timing, size, passed, assertionResults, error? }
interface CollectionRunResult { runId, collectionId, collectionName, total, passed, failed, skipped, timing, results }
interface RunnerStartedEvent { runId, collectionId, total, requestNames }
interface RunnerProgressEvent { runId, index, total, result }
```

### `cookies.ts`

```typescript
interface StoredCookie { name, value, domain, path, expires?, httpOnly, secure, sameSite?, createdAt }
```

### `graphql-subscription.ts`

```typescript
type GqlSubscriptionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
interface GqlSubscriptionEvent { id, type: 'data'|'error'|'complete', data, timestamp }
interface GqlSubStatusChanged { requestId, status, error? }
```

### `constants.ts`

```typescript
HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','QUERY','HEAD','OPTIONS','LIST'] as const
BODY_TYPES = ['none','json','xml','form-data','urlencoded','raw','graphql'] as const
AUTH_TYPES = ['inherit','none','bearer','basic','api-key','oauth2'] as const
SENSITIVE_HEADERS = ['authorization','x-api-key','cookie','set-cookie', ...]
SENSITIVE_PARAM_KEYS = ['api_key','apikey','token','secret','password', ...]
DEFAULTS = { REQUEST_TIMEOUT_MS: 30000, FOLLOW_REDIRECTS: true,
    VERIFY_SSL: true, MAX_SCRIPT_CHAIN_DEPTH: 3, MAX_VARIABLE_NESTING: 10,
    SESSION_LOG_MAX_ENTRIES: 100, SESSION_LOG_BODY_MAX_SIZE: 50 * 1024 }
WS_MESSAGE_LOG_MAX = 500
isWebSocketRequest(method) → boolean  // method === 'WEBSOCKET'
```

### `curl-parser.ts`

```typescript
interface ParsedCurl { method, url, headers: KeyValueEntry[], queryParams: KeyValueEntry[],
    body: string | null, body_type: BodyType, auth: AuthConfig | null }
isCurlCommand(input: string) → boolean
parseCurl(input: string) → ParsedCurl
```

---

## Svelte Stores (Runes Pattern)

All stores use this pattern: module-level `$state` + `$derived` + exported object with getters + actions.

### `appStore` — `lib/stores/app.svelte.ts`

**State**: `activeWorkspaceId`, `openTabs: Tab[]`, `activeTabId`, `sidebarCollapsed`, `sidebarMode`, `sidebarSearch`, `tabStates: Record<string, TabRequestState>`, `envTabStates: Record<string, TabEnvironmentState>`, `mcpTabStates: Record<string, TabMcpState>`, `wsTabStates: Record<string, TabWebSocketState>`, `containerEditorTabStates: Record<string, TabContainerEditorState>`

**Key types**:
- `Tab { id, type: 'request'|'environment'|'mcp'|'websocket'|'collection'|'folder', entityId, label, method?, pinned, isUnsaved, isDraft }`
- `TabMcpState { serverId, activeLeftTab: 'tools'|'resources'|'prompts', activeRightTab: 'response'|'traffic'|'notifications', lastResponse: McpLastResponse | null }`
- `TabWebSocketState { name, url, headers, protocols, composerMessage, composerType }`
- `TabRequestState { name, method, url, headers, query_params, body, body_type, auth, scripts, response, loading, activeSubTab?, streaming?, sseEvents?, sseBody?, sseMetrics?, gqlSubStatus?, gqlSubEvents? }`
- `TabEnvironmentState { name, variables, isDirty, initialized }`
- `TabContainerEditorState { auth: AuthConfig, environmentIds: string[], defaultEnvironmentId, variables?, scripts: ScriptsConfig, activeSubTab, isDirty, initialized }`

**Actions**: `openRequestTab`, `openDraftTab`, `promoteDraft`, `openEnvironmentTab`, `openMcpTab`, `openWebSocketTab`, `openCollectionEditorTab`, `openFolderEditorTab`, `closeTab`, `closeOtherTabs`, `closeAllTabs`, `reorderTabs`, `togglePinTab`, `setActiveTab`, `nextTab`, `prevTab`, `toggleSidebar`, `getTabState`, `updateTabState`, `markTabSaved`, `updateTabLabel`, `getEnvTabState`, `updateEnvTabState`, `getMcpTabState`, `updateMcpTabState`, `getWsTabState`, `updateWsTabState`, `markWsTabSaved`, `getContainerEditorTabState`, `updateContainerEditorTabState`

**Draft requests**: `openDraftTab()` creates a transient in-memory request tab (`isDraft: true`, entity ID `draft-{counter}-{timestamp}`) with no DB backing. Drafts can be sent (the proxy only needs the config object) but don't appear in the sidebar tree. `promoteDraft(tabId, request)` replaces a draft tab in-place with a persisted tab after the user saves to a collection. OAuth2 token operations are disabled on drafts (config fields remain editable).

**Session persistence**: Open tabs + active tab serialized to `app_settings` key `session.tabs.{workspaceId}` (debounced 500ms, scoped per workspace). Draft tabs are excluded — they are transient and lost on restart. Restored on mount after collections/environments load. Deleted entities silently skipped.

### `collectionsStore` — `lib/stores/collections.svelte.ts`

**State**: `collections`, `folders`, `requests`, `tree: TreeNode[]`, `expandedIds: Set`

**`TreeNode`**: `{ type: 'collection'|'folder'|'request', id, name, children, expanded, collectionId, parentId, method? }`

**Actions**: `loadAll`, `rebuildTree`, `toggleExpanded`, `expandAll`, `collapseAll`, `createCollection/Folder/Request/WebSocket`, `renameCollection/Folder/Request`, `deleteCollection/Folder/Request`, `reloadCollection`, `getRequestById`, `getCollectionById`, `getFolderById`, `revealRequest`, `resolveDefaultEnvironment`, `resolveInheritedAuth`, `resolveInheritedAuthForFolder`

**`revealRequest(requestId)`**: Expands the collection and all ancestor folders so the request is visible in the sidebar tree.

**`resolveDefaultEnvironment(requestId)`**: Walks up the folder chain → collection, returns the first `default_environment_id` found (nearest folder wins).

### `environmentsStore` — `lib/stores/environments.svelte.ts`

**State**: `environments`, `activeEnvironmentId`, `vaultHealthy` (`true | false | null` — null when not vault-synced or not yet checked)

**Actions**: `loadAll`, `create`, `update`, `remove`, `activate`, `deactivate`, `getById`

**Vault pre-fetch**: `activate()` and `loadAll()` (on startup) trigger `environments:activate` IPC which pre-fetches vault secrets. The return value sets `vaultHealthy`, which drives the EnvironmentSelector LED color (green = healthy, red = failed).

### `toastsStore` — `lib/stores/toasts.svelte.ts`

**State**: `toasts: Toast[]` (max 3 visible, auto-dismiss after 8s)

**Actions**: `addToast(category, message)`, `dismissToast(id)`, `pauseToast(id)`, `resumeToast(id)`

**Toast interface**: `{ id, category: 'sync' | 'vault' | 'update', message, timestamp }`

Pause/resume supports hover-to-hold: `pauseToast` clears the JS timeout and records remaining time; `resumeToast` restarts with the remaining duration. Timer bookkeeping consolidated into a single `timerStates` Map (per-toast `{ timer, startedAt, remaining }`).

### `mcpStore` — `lib/stores/mcp.svelte.ts`

**State**: `servers: McpServer[]`, `connectionStates: Record<string, McpServerState>`, `trafficLog: McpTrafficEntry[]`, `notifications: McpNotification[]`

**Actions**: `loadServers`, `createServer`, `updateServer`, `deleteServer`, `reorderServers`, `connect`, `disconnect`, `callTool`, `listResources`, `readResource`, `listResourceTemplates`, `listPrompts`, `getPrompt`, `getTrafficLog`, `clearTrafficLog`

**Push handlers**: `handleStatusChanged`, `handleToolsChanged`, `handleResourcesChanged`, `handlePromptsChanged`, `handleTrafficPush`, `handleNotification` — registered in `App.svelte` `onMount`

**IPC serialization**: Uses `$state.snapshot()` before sending reactive proxy objects through Electron IPC (prevents "object could not be cloned" errors).

### `wsStore` — `lib/stores/websocket.svelte.ts`

**State**: `connectionStates: Record<string, WsConnectionState>`, `messageLogs: Record<string, WsMessage[]>`

**Actions**: `connect`, `disconnect`, `sendMessage`, `loadMessages`, `clearMessages`, `getState`, `getMessages`

**Push handlers**: `handleStatusChanged`, `handleMessageReceived` — registered in `App.svelte` `onMount`

Mirrors the `mcpStore` pattern. Connection management happens in the main process (`websocket-client.ts`); the store receives push events and updates reactive state.

### `settingsStore` — `lib/stores/settings.svelte.ts`

**State**: `allSettings: Record<string, string>`

**Actions**: `loadAll`, `get(key)`, `set(key, value)` — typed settings keys with IPC persistence. Used for app-wide preferences (layout orientation, timeout, SSL, theme, split percentages, etc.).

**Settings keys**: `request.layout`, `request.timeout`, `request.verify_ssl`, `request.follow_redirects`, `request.splitPercent`, `mcp.splitPercent`, `app.version`, `app.welcomed`, `app.theme`, `app.text_size`, `sidebar.width`, `tls.ca_cert_path`, `tls.client_cert_path`, `tls.client_key_path`, `tls.client_key_passphrase`, `proxy.url`, `proxy.username`, `proxy.password`, `proxy.no_proxy`

### `graphqlStore` — `lib/stores/graphql.svelte.ts`

**State**: `cache: Record<string, SchemaEntry>` — keyed by URL. Each entry: `{ schema: GraphQLSchema | null, loading, error }`.

**Actions**: `getSchema(url)`, `fetchSchema(url, headers, wsId?, colId?)`, `clearSchema(url)`

Caches introspection results per URL in the renderer (LRU eviction at 20 entries). `fetchSchema` calls `api.graphql.introspect()` (main process), which sends the standard introspection query via undici, resolves `{{variables}}` in URL/headers, and respects SSL settings. The resulting `GraphQLSchema` is passed to CodeMirror's `cm6-graphql` extension for autocompletion.

---

## Services

### Encryption (`services/encryption.ts`)
- `initEncryption()` → generates/loads 256-bit master key via Electron `safeStorage`, persists encrypted blob to `{userData}/master.key` with `0o600` file permissions
- Master key file uses `vxk1:` prefix to distinguish keychain-encrypted format from legacy plaintext (handles graceful migration). Logs `console.warn` when using plaintext fallback
- `encryptValue(plaintext)` → AES-256-GCM, returns `gcm:` + base64(IV[12] + authTag[16] + ciphertext)
- `decryptValue(encrypted)` → detects format: `gcm:` prefix → AES-256-GCM; otherwise → legacy AES-256-CBC fallback for backward compatibility
- `initEncryptionForTesting(key?)` → bypass safeStorage for Vitest
- **Repository-layer integration**: encryption is transparent at the repository layer — callers (IPC, services, UI) are unaware
  - **Settings**: `SENSITIVE_KEYS` set (`vault.token`, `vault.role_id`, `vault.secret_id`, `vault.aws_access_key_id`, `vault.aws_secret_access_key`, `sync.token`, `tls.client_key_passphrase`, `proxy.username`, `proxy.password`) — encrypted on write, decrypted on read with try/catch fallback for pre-migration plaintext
  - **Environments**: variable values encrypted with `enc:` prefix — `encryptVariables()`/`decryptVariables()` in all CRUD paths
  - **Requests**: auth credentials (`bearer_token`, `basic_username`, `basic_password`, `api_key_value`, `oauth2_client_secret`, `oauth2_password`, `oauth2_access_token`, `oauth2_refresh_token`) encrypted with `enc:` prefix — `encryptAuth()`/`decryptAuth()` in all CRUD paths; double-encryption guard checks `enc:` prefix before encrypting
  - **Workspace settings**: sensitive fields in `workspaces.settings` JSON column encrypted/decrypted using the same key set as `app_settings`
  - **One-time migration**: `migrateToEncryptedStorage()` runs at startup, encrypts existing plaintext data, tracked by `encryption.migrated` setting

### Workspace-Scoped Settings (`database/repositories/workspaces.ts`)
- Stored in the existing `workspaces.settings TEXT` column as a JSON blob
- `getWorkspaceSettings(wsId)` → parse JSON, decrypt sensitive fields, return nested object
- `setWorkspaceSetting(wsId, key, value)` → read-modify-write; key uses dot-notation (e.g., `sync.provider`)
- `getWorkspaceSetting(wsId, key)` → convenience: dot-path into nested object
- Sensitive keys encrypted: `sync.token`, `vault.token`, `vault.role_id`, `vault.secret_id`, `vault.aws_access_key_id`, `vault.aws_secret_access_key`
- **Fallback pattern**: Services (`getProvider`) try workspace settings first, fall back to global `app_settings` if workspace has no config for that domain
- Provider cache invalidation: `ipc/settings.ts` monitors `PROVIDER_KEYS` set and calls `resetVaultProvider()` when relevant keys change

### MCP Client (`services/mcp-client.ts`)
- Manages MCP server connections using `@modelcontextprotocol/sdk` Client class
- **Transports**: `StdioClientTransport` (local process), `StreamableHTTPClientTransport` (HTTP), `SSEClientTransport` (legacy SSE)
- `connections: Map<string, { client, transport, state }>` — active connections keyed by server ID
- `trafficLog: McpTrafficEntry[]` — in-memory ring buffer (500 entries) for JSON-RPC traffic inspection
- `connect(server)` → creates transport with `{{variable}}` substitution (command, args, env values, cwd, url, header values resolved via active environment + vault), wires notification handlers (tools/resources/prompts list_changed → auto-refresh + push), fetches initial capabilities, returns `McpServerState`
- `disconnect(serverId)` → removes notification handlers, calls `client.close()`, removes from map, pushes status change
- `disconnectAll()` → called on `app.will-quit` for cleanup
- Primitive wrappers: `listTools`, `callTool`, `listResources`, `readResource`, `listResourceTemplates`, `listPrompts`, `getPrompt` — each logs traffic entries
- `pushToRenderer(channel, data)` → broadcasts to all `BrowserWindow.getAllWindows()`
- **Sanitization**: All SDK results sanitized with `JSON.parse(JSON.stringify())` to strip non-cloneable properties before IPC transit
- **Notification schemas**: Uses Zod schemas from `@modelcontextprotocol/sdk/types.js` (`ToolListChangedNotificationSchema`, etc.)

### TLS & Proxy Options (`services/tls-options.ts`)
- `getTlsConfig(verifySsl)` → reads cert paths from settings, loads files via `readFileSync`, returns `{ ca?, cert?, key?, passphrase?, rejectUnauthorized }`
- `getProxyConfig()` → reads proxy URL/auth from settings, builds Basic auth token, parses no_proxy list. Returns `null` when no proxy configured
- `shouldProxy(targetUrl, noProxy)` → hostname matching against no_proxy patterns (exact, `*.local` wildcard, `.corp.com` suffix, `*` catch-all)
- `createUndiciDispatcher(verifySsl, targetUrl?)` → returns `ProxyAgent` when proxy configured (with TLS in `requestTls`), `Agent` for custom TLS only, `undefined` for defaults
- `createHttpsAgent(verifySsl)` → returns `https.Agent` for WebSocket client (proxy support is future enhancement)
- CA cert only loaded when `verifySsl === true`; client cert/key loaded regardless (mTLS is client auth)
- Throws descriptive errors for missing cert files

### Fetch Error Formatting (`services/fetch-error.ts`)
- `formatFetchError(error, url?)` → user-friendly error message from undici/fetch errors
- Unwraps `error.cause.code` for descriptive messages: SSL certificate errors, PEM format errors, DNS lookup failures, connection refused, timeouts, proxy rejections, abort signals
- Shared by proxy handler and vault IPC handlers

### HTTP Proxy (`ipc/proxy.ts`)
- Uses Node `fetch` with `AbortController` per request ID
- Handles all body types: string body (json/xml/raw/urlencoded/graphql), `FormData` (form-data with file support)
- Auto-sets Content-Type headers unless user overrides
- Parses `set-cookie` response headers into structured `ResponseCookie[]`
- Returns timing: `{ start, ttfb, total }` via `performance.now()`
- **Vault cache**: calls `ensureLoaded()` for vault-synced active environments before substitution (handles cold-cache on first request after app start without auto-sync)
- **Substitutes `{{variables}}`** in URL, headers (keys+values), body, form-data text values before sending
- **Pre-request scripts**: executes dependent requests before main send
- **Post-response scripts**: extracts values and sets collection variables after response
- **Assertions**: evaluates request assertions after post-scripts, attaches `assertionResults` to `ResponseData`
- **Cookie jar**: injects cookies before fetch (via `getCookieHeader`), captures Set-Cookie after response (via `captureCookies`). Controlled by `request.send_cookies` setting (default: true). User-set `Cookie` headers take priority
- **Logs** template URL (not resolved URL with secrets) to session log; error bodies use `error.message` (not stack traces)
- **HTTP detail capture**: Builds `HttpLogDetail` on both success and failure paths — captures request method/URL/headers/body/queryParams and response status/headers/body/size/timing/cookies. String bodies truncated to `SESSION_LOG_BODY_MAX_SIZE` (50KB); form-data bodies (UndiciFormData) skipped. Passed to `logHttp()` for expandable detail in the session log UI
- **SSE streaming**: Auto-detects `Content-Type: text/event-stream` responses. Reads body via async iterator, parses events with `SSEParser`, and pushes `sse:stream-start/chunk/end` IPC events to the renderer in real-time. The `proxy:send` invoke still resolves with the complete `ResponseData` (including `isSSE: true` and `sseEvents[]`) when the stream finishes. Timeout is cleared for SSE streams (user cancels manually via AbortController)
- **Security validation**: URL scheme whitelist (http/https only), timeout clamped 1-300s, response body size limit 50MB (content-length check), form-data file paths validated against dialog-approved set (single-use, path traversal rejected, symlinks rejected). Any HTTP method string is accepted (uppercased before sending)
- **Variable caching**: resolves all variables once per request via `getResolvedVariables()` + `substituteWith()` to avoid N+1 DB lookups

### Variable Substitution (`services/variable-substitution.ts`)
- `getResolvedVariables(wsId?, colId?)` → flat `Record<string, string>` (env vars + collection overrides)
- `getResolvedVariablesWithSource(wsId?, colId?)` → `Record<string, { value, source }>` for tooltips
- `substitute(text, wsId?, colId?)` → resolve `{{varName}}` in text
- `substituteWith(text, variables)` → resolve using pre-resolved variable map (avoids N+1 DB lookups when substituting multiple values in a single request)
- `substituteRecord(record, wsId?, colId?)` → resolve vars in both keys and values
- Nested reference resolution up to `MAX_VARIABLE_NESTING` (10) iterations
- Priority: active environment vars (base) → collection vars (override)
- **Vault-synced environments**: when `vault_synced === 1`, reads variables from in-memory cache (`getCachedVariables`) instead of parsing the DB `variables` field (which is always `'[]'`)

### Script Execution (`services/script-execution.ts`)
- **Request-level pre-request**: `executePreRequestScripts(reqId, colId, wsId?)` — fires dependent requests before the main one
- **Container-level pre-request**: `executeContainerPreRequestScripts(colId, folderId, wsId?)` — runs collection scripts first, then folder chain top-down. Supports `skip_if_valid` to skip token fetch when cached token is still valid (30s safety margin)
- **Post-response**: `executePostResponseScripts(reqId, colId, response, wsId?)` — extracts values from response and sets collection variables. Supports `set_token_expiry` action that converts `expires_in` (seconds) to absolute timestamp
- Circular dependency detection via per-chain execution stack (no shared global state)
- Max chain depth: `DEFAULTS.MAX_SCRIPT_CHAIN_DEPTH` (3)
- `extractValue(source, status, body, headers)` — supports `status`, `header.Name`, `body.key.nested[0].id`
- `extractJsonPath(data, path)` — dot-notation with `[n]` array index support
- Mirrors extracted values to active environment if key exists there — for vault-synced environments, updates in-memory cache and pushes to Vault (fire-and-forget) instead of writing to DB

### OAuth 2.0 (`services/oauth2.ts`)
- **PKCE**: `generateCodeVerifier()` (32 random bytes → base64url), `generateCodeChallenge(verifier)` (SHA-256 → base64url)
- **Token exchange**: `exchangeAuthorizationCode()`, `exchangeClientCredentials()`, `exchangePassword()`, `refreshAccessToken()` — all POST to token URL with `application/x-www-form-urlencoded` body; response fallback handles form-encoded providers (e.g. GitHub)
- **Token expiry**: `isTokenExpired(auth)` — returns true within 30-second safety margin
- **Callback server**: `startCallbackServer(port?)` — ephemeral HTTP server on `127.0.0.1`, returns auth code from redirect, auto-closes after 5-minute timeout
- **Authorization flow**: `startAuthorizationFlow(auth)` — builds auth URL with PKCE, opens system browser via `shell.openExternal()`, waits for callback
- **Auto-refresh**: proxy and script-execution check `isTokenExpired()` before sending; if expired, `refreshAccessToken()` runs automatically and persists new tokens. A per-token-URL mutex prevents concurrent refresh requests when multiple requests expire simultaneously
- Encrypted fields: `oauth2_client_secret`, `oauth2_password`, `oauth2_access_token`, `oauth2_refresh_token`

### Code Generator (`services/code-generator.ts`)
- `generateCode(language, data, wsId?, colId?)` — generates code snippet from request data
- Languages: curl, Python (requests), PHP (Laravel HTTP), JavaScript (fetch), Node.js (axios), Go (net/http), Ruby (Net::HTTP), C# (HttpClient), Java (HttpClient)
- Applies variable substitution before generating
- Handles all body types + auth types (including OAuth2 bearer header)

### Insomnia Import (`services/insomnia-import.ts`)
- `importInsomnia(json, wsId?)` → `InsomniaImportResult`
- Detects Insomnia v4 format: `_type === 'export'` + `typeof __export_format === 'number'`
- Maps resources: `workspace` → collection, `request_group` → folder, `request` → request, `environment` → environment
- Body types: `application/json` → json, `application/xml` → xml, `multipart/form-data` → form-data, `application/x-www-form-urlencoded` → urlencoded, `application/graphql` → graphql
- Auth mapping: bearer, basic, api-key, oauth2
- Multi-pass folder nesting resolution; skips base environments, cookie jars, API specs

### Session Log (`services/session-log.ts`)
- In-memory ring buffer, max `DEFAULTS.SESSION_LOG_MAX_ENTRIES` (100) entries
- Entry: `{ id, category, type, target, message, success, timestamp, detail? }`
- Categories: `http`, `sync` (displayed as "git"), `vault`, `system`
- Optional `detail?: HttpLogDetail` — structured request/response data for HTTP entries (method, URL, headers, body, query params, status, timing, cookies)
- Pushes new entries to renderer via `BrowserWindow.webContents.send(IPC.LOG_PUSH)`
- Convenience helpers: `logSync()`, `logVault()`, `logHttp(…, detail?)`, `logSystem()`

### YAML Serializer (`services/yaml-serializer.ts`)
- `serializeToDirectory(collection, options?)` → `Record<path, yamlContent>` file map — fetches requests via `requestsRepo.findByCollection()` (ensures auth fields are decrypted)
- `serializeRequest(request, options?)` → YAML string
- `importFromDirectory(files, existingId?, workspaceId?)` → collection ID (creates or updates)
- Directory structure: `{uuid}/_collection.yaml`, `_manifest.yaml`, `{reqUuid}.yaml`, `{folderUuid}/_folder.yaml`
- Manifest files track folder/request ordering
- Environment hints: vault_path-based cross-machine environment ID resolution
- `validateEnvironmentIds()` handles `environment_ids` as both YAML arrays and JSON strings
- `sanitize` option strips sensitive data via `sanitizeRequestData()`/`sanitizeCollectionData()`
- Strips local file references from form-data before sync
- `parseYaml()` validates non-null/non-empty returns; `serializeRequest()` wraps JSON.parse of scripts/auth in try/catch

### MCP YAML Serializer (`services/mcp-yaml-serializer.ts`)
- `serializeMcpServer(server, options?)` → YAML string — serializes one MCP server config
- `serializeMcpServersDirectory(servers, options?)` → `Record<path, yamlContent>` file map (one file per server + `_manifest.yaml`)
- `importMcpServerFromYaml(content, workspaceId)` → server ID (creates or upserts)
- `importMcpServersFromDirectory(files, workspaceId)` → server ID array
- Directory structure: `mcp-servers/{uuid}.yaml`, `_manifest.yaml` (ordering)
- `sanitize` option strips sensitive env/header values via `sanitizeMcpServerData()`
- Handles stdio servers (command, args, env, cwd) and HTTP servers (url, headers)

### SSE Parser (`services/sse-parser.ts`)
- Stateful text parser per the [SSE spec](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)
- `push(chunk: string): SSEEvent[]` — returns 0+ complete events per chunk, buffers partial lines across boundaries
- Handles: multi-line `data:` fields (joined with `\n`), `event:` field (defaults to `'message'`), `id:` field (persists across events), comment lines (`:` prefix ignored), all line ending styles (`\n`, `\r\n`, `\r`)
- Used by `handleSSEStream()` in `ipc/proxy.ts`

### Sensitive Data Scanner (`services/sensitive-data-scanner.ts`)
- `scanRequest(request)` → `SensitiveFinding[]` — scans auth, headers, params, body
- `scanCollection(requests, variables)` → `SensitiveFinding[]` — scans all requests (using decrypted data from repository) + collection variables
- `scanMcpServer(server)` → `SensitiveFinding[]` — scans env values against `SENSITIVE_PARAM_KEYS`, header values against `SENSITIVE_HEADER_KEYS`, skips `{{variable}}` references
- `sanitizeRequestData(data)` / `sanitizeCollectionData(data)` / `sanitizeMcpServerData(data)` — blanks sensitive values, preserves `{{var}}` references
- Extensive sensitive key lists: auth tokens, API keys, passwords, cloud keys, PII
- Recursive JSON body scanning

### Assertion Evaluator (`services/assertion-evaluator.ts`)
- `evaluateAssertions(assertions, response)` → `AssertionResult[]` — pure function, no DB access
- `evaluateRequestAssertions(requestId, response)` → reads assertions from request's `scripts` column, delegates to `evaluateAssertions`
- Assertion types: `status`, `header` (case-insensitive key lookup), `json_path` (reuses `extractJsonPath` from script-execution), `response_time` (total ms)
- Operators: `equals`, `not_equals`, `contains`, `not_contains`, `exists`, `not_exists`, `less_than`, `greater_than`, `matches_regex` (ReDoS protection: 500-char limit)
- Disabled assertions (`enabled: false`) are skipped

### Collection Runner (`services/collection-runner.ts`)
- `startRun(collectionId, workspaceId, callbacks)` → `CollectionRunResult` — executes all requests sequentially
- Walks collection tree in sidebar order (root requests first by `order`, then folders recursively)
- Skips `WEBSOCKET` requests
- Per-request: runs pre-scripts → HTTP fetch → post-scripts → assertion evaluation
- Pass/fail: `status !== 0` AND all enabled assertions pass
- Cancellable via `AbortController` (checked between requests)
- Results are ephemeral (in-memory only, not persisted)
- Push events: `runner:started`, `runner:progress`, `runner:complete`

### Cookie Jar (`services/cookie-jar.ts`)
- In-memory cookie store (Map keyed by domain) — cleared on app restart
- `captureCookies(url, cookies)` — stores cookies from Set-Cookie headers, RFC 6265 compliant
- `getCookieHeader(url)` → cookie header string or undefined — domain/path/secure matching, expired cookies purged on read, sorted by longest path first
- `listAll()` → all cookies sorted by domain+name
- `clearAll()` / `deleteCookie(domain, name)` — management functions
- Domain matching: no `Domain` attr = exact host only; with `Domain` = host + subdomains

### GraphQL Subscription Client (`services/graphql-subscription.ts`)
- Implements `graphql-transport-ws` protocol over raw `ws` WebSocket (no npm dependency)
- `subscribe(requestId, config, callbacks)` — opens WS, sends `connection_init` + `subscribe`, streams `next` events
- `unsubscribe(requestId)` — sends `complete`, closes WS
- `disconnectAll()` — called on app quit
- Auto-converts `https://` → `wss://`, respects TLS settings via `createHttpsAgent`
- One subscription per request tab at a time
- Connection timeout: 10s for `connection_ack`

### Git Providers (`sync/github-provider.ts`, `sync/gitlab-provider.ts`)
- Both implement `GitProvider` interface from `sync/git-provider.interface.ts`
- **GitHub**: Git Data API (trees for listing, blob+tree+commit+ref for atomic multi-file commits), Contents API for single files. Paths passed directly to Contents API (no `encodeURIComponent` — GitHub handles slashes natively).
- **GitLab**: Repository API v4 (tree listing with pagination via `x-next-page` header, Files API, Commits API with actions array for atomic commits). Uses `encodeURIComponent` per GitLab's file path encoding requirement.
- Key difference: GitHub uses blob SHA for conflict detection, GitLab uses `last_commit_id`
- Both: `listDirectoryRecursive()`, `getDirectoryTree()`, `getFile()`, `createFile()`, `updateFile()`, `deleteFile()`, `deleteDirectory()`, `commitMultipleFiles()`, `testConnection()`
- **Self-hosted support**: both accept an optional `baseUrl` constructor parameter. GitHub Enterprise derives `{baseUrl}/api/v3`, GitLab derives `{baseUrl}/api/v4`. When omitted, defaults to the public cloud API. Public cloud URLs (`github.com`, `gitlab.com`) are normalized to the correct default API endpoint.

### Remote Sync Service (`sync/remote-sync-service.ts`)
- Settings keys: `sync.provider`, `sync.repository`, `sync.token`, `sync.branch`, `sync.base_url` — read via workspace settings with global fallback (transparent decryption)
- `getProvider(workspaceId?)` → creates git provider from workspace-scoped config, falls back to global `app_settings`
- `pull(workspaceId?)` → `SyncResult` — pulls all collections + MCP servers, detects conflicts (with per-file change details via `computeConflictDetails()`), collects per-collection errors
- `pushCollection(collection, sanitize?, workspaceId?)` — 3-way merge per file, atomic commit
- `pushAll(workspaceId?)` → `SyncResult` — pushes all dirty/unsynced collections + MCP servers (scoped to workspace)
- `pullMcpServers(provider, workspaceId?)` — imports new MCP servers from remote, updates changed ones, skips conflicts
- `pushMcpServer(server, sanitize?, workspaceId?)` — serializes and pushes single MCP server + manifest
- `pushAllMcpServers(workspaceId?)` — pushes all dirty/new sync-enabled MCP servers
- `deleteMcpServerRemote(server, workspaceId?)` — deletes server file from remote and updates manifest
- `pullSingleCollection(collection, workspaceId?)` — force-pulls one collection (overwrites local even when dirty, clears `is_dirty`). Logs on all code paths: "No remote data found", "Already up to date", "Pulled from remote successfully"
- `pushSingleRequest(collection, requestId, sanitize?, workspaceId?)` — granular single-file push (fetches request via `requestsRepo.findById()` for decrypted auth). On 409/400 (conflict): logs and marks dirty for full sync. On other errors: logs failure and marks dirty
- `forceKeepLocal(collection, workspaceId?)` / `forceKeepRemote(collection, workspaceId?)` — conflict resolution
- `deleteRemoteCollection(collection, workspaceId?)` — removes from remote
- `SyncConflictError` class for conflict detection
- File state: `{path: {content_hash, remote_sha, commit_sha}}` with backward-compat normalization
- Blob SHA computed locally: `SHA-1("blob {size}\0{content}")` — avoids extra API call after push
- `buildFolderPath()` has cycle detection via `visited` Set to prevent infinite loops from data corruption

### HashiCorp Vault Provider (`vault/hashicorp-vault-provider.ts`)
- Implements `SecretsProvider` interface from `vault/secrets-provider.interface.ts`
- KV v2 + v1 API: `listSecrets()` tries 4 strategies (v2 LIST, v2 GET?list=true, v1 LIST, v1 GET?list=true), `getSecrets()`, `putSecrets()`, `deleteSecrets()`
- Auth methods: token (direct) or AppRole (login to get token)
- `X-Vault-Namespace` header sent only during AppRole login — NOT on data operations. For namespaced engines, include the full namespace path in the `mount` (engine path) setting instead.
- `testConnection()` — token: lookup-self, AppRole: login attempt; also queries `/v1/sys/mounts` to verify the configured mount exists
- AppRole login validates response: guards against null `json.auth` with explicit error
- **AppRole token auto-refresh**: on 403 responses, automatically re-authenticates via AppRole login and retries the request once
- Static factory: `HashiCorpVaultProvider.create(opts)` handles async AppRole login
- SSL bypass: when `verifySsl` is false, uses undici `Agent({ connect: { rejectUnauthorized: false } })` — all HTTP calls route through `this.fetch()` wrapper which dispatches via undici when the custom Agent is present

### AWS Secrets Manager Provider (`vault/aws-secrets-manager-provider.ts`)
- Implements `SecretsProvider` interface from `vault/secrets-provider.interface.ts`
- One JSON secret per environment (key-value pairs stored as `SecretString`)
- `listSecrets(basePath?)` → `ListSecretsCommand` with pagination, optional name prefix filter
- `getSecrets(path)` → `GetSecretValueCommand`, parses `SecretString` as JSON, returns `null` on `ResourceNotFoundException`
- `putSecrets(path, data)` → `PutSecretValueCommand`, falls back to `CreateSecretCommand` on 404
- `deleteSecrets(path)` → `DeleteSecretCommand` with `ForceDeleteWithoutRecovery: true`, ignores 404
- `testConnection()` → `ListSecretsCommand({ MaxResults: 1 })`, returns boolean
- Credential resolution order: (1) explicit `accessKeyId` + `secretAccessKey`, (2) `fromIni({ profile })` for named profiles, (3) SDK default credential chain
- Optional `endpoint` override for LocalStack or other AWS-compatible services
- Private constructor; use static factory `AwsSecretsManagerProvider.create(opts)`

### Vault Sync Service (`vault/vault-sync-service.ts`)
- **In-memory only**: vault secrets are never written to the local SQLite DB. The DB stores vault metadata (`vault_synced`, `vault_path`, `name`) but `variables` is always `'[]'` for vault-synced environments. Secrets live in a session-lifetime in-memory cache (`Map<string, EnvironmentVariable[]>`)
- Settings keys (HashiCorp): `vault.provider`, `vault.url`, `vault.auth_method`, `vault.token`, `vault.role_id`, `vault.secret_id`, `vault.namespace`, `vault.mount`, `vault.verify_ssl`
- Settings keys (AWS): `vault.provider`, `vault.aws_region`, `vault.aws_access_key_id`, `vault.aws_secret_access_key`, `vault.aws_profile`, `vault.aws_endpoint`
- All settings read from workspace settings with global fallback
- `vault.verify_ssl` parsed as boolean: `'0'` and `'false'` both mean SSL verification off (UI stores `String(boolean)`)
- `getProvider(workspaceId?)` → reads vault config, dispatches to HashiCorp or AWS based on `vault.provider`, returns cached `SecretsProvider` (cache keyed by `workspaceId ?? '__global__'`)
- `isConfigured(workspaceId?)` → provider-specific: HashiCorp needs `vault.url`, AWS needs `vault.aws_region`
- `fetchVariables(envId, workspaceId?)` → get secrets from Vault, return as `EnvironmentVariable[]`, populate in-memory cache (session-lifetime, no TTL)
- `pushVariables(envId, vars, workspaceId?)` → push enabled variables to Vault, update in-memory cache, scrub DB `variables` to `'[]'` if non-empty (defense-in-depth)
- `deleteSecrets(envId, workspaceId?)` → remove secrets for an environment, clear cache
- `pullAll(wsId?)` → list all secrets at mount root, create environments for untracked paths with `variables: '[]'`, populate in-memory cache for all environments
- `migrateEnvironment(envId, oldPath, newPath, workspaceId?)` → copy secrets to new path, delete old
- `resetProvider(workspaceId?)` → invalidate provider cache + clear secrets cache (called automatically when vault settings change)
- `buildPath(env)` → uses `vault_path` if set, otherwise slugifies environment name
- `getCachedVariables(envId)` → read cached secrets (returns `null` if not cached)
- `setCachedVariables(envId, vars)` → update cached secrets (used by script-execution mirroring)
- `ensureLoaded(envId, wsId?)` → fetch from Vault if not already cached (used by proxy handler before variable substitution)

### Data Export/Import (`services/data-export-import.ts`)
- Export: `exportAll(wsId?)`, `exportCollections(wsId?)`, `exportEnvironments(wsId?)`, `exportMcpServers(wsId?)`, `exportConfig()`
- Single-item export: `exportSingleCollection(id)`, `exportSingleMcpServer(id)` (used by sidebar context menus)
- All exports return: `{ vaxtly_export: true, version: 1, type, exported_at, data }`
- `importData(json, wsId?)` → detects type, dispatches to importCollections/Environments/McpServers/Config
- Collections exported with nested folder tree + requests; vault-synced environments export with empty variables
- MCP servers exported with transport config (command/args/env/cwd for stdio; url/headers for http/sse)
- Config export covers `sync.*` and `vault.*` settings (tokens NOT exported)
- Unique name generation for duplicate collections/environments/MCP servers

### Postman Import (`services/postman-import.ts`)
- `importPostman(json, wsId?)` → `PostmanImportResult`
- Three Postman formats detected automatically:
  - **Workspace dump**: `version` + `collections[]` — flat folder/request arrays with parent ID references, multi-pass resolution
  - **Collection v2.1**: `info._postman_id`/`info.schema` — recursive `item` tree (folders have `item[]`, requests have `request`)
  - **Environment**: `_postman_variable_scope = 'environment'` or `values[]` + `name`
- Body type mapping: raw→json/xml/raw, urlencoded, formdata→form-data, graphql
- URL extraction handles both string URLs and Postman URL objects (with host/path arrays)

### Auto-Updater (`services/updater.ts`)
- Uses `electron-updater` (`autoUpdater`) for update detection across all platforms
- **Dev guard**: `initUpdater()` and `checkForUpdates()` are no-ops when `!app.isPackaged`
- **Install source detection**: `getInstallSource()` returns `'brew' | 'scoop' | 'standalone'`
  - macOS always returns `'brew'`
  - Windows: checks `app.getPath('exe')` for `scoop\apps` → `'scoop'`, otherwise `'standalone'`
  - Linux always returns `'standalone'`
- **Package-managed installs** (Homebrew / Scoop): `autoDownload = false`, `autoInstallOnAppQuit = false`, `quitAndInstall()` is a no-op — user updates via their package manager
- **Standalone installs**: `autoDownload = true` — downloads in background, then offers quit-and-install
- Events pushed to renderer via `BrowserWindow.getAllWindows()`:
  - `update:available` → `{ version, releaseName }`
  - `update:progress` → `{ percent }` (standalone only)
  - `update:downloaded` → `{ version }`
  - `update:error` → error message string
- `checkForUpdates()` called automatically on `ready-to-show` and manually via menu/settings
- **App.svelte banner**: install-source-aware top banner — Homebrew shows `brew upgrade vaxtly` + copy button; Scoop shows `scoop update vaxtly` + copy button; standalone shows download progress bar → "Restart now" button; dismissible
- **GeneralTab**: "Check for updates" button in About section with checking/available/up-to-date/error states; 15s timeout assumes up-to-date if no event received
- **CI**: `update-scoop` job in `build.yml` computes SHA256 of `Vaxtly-{version}-setup.exe` and pushes manifest to `vaxtly/scoop-bucket/bucket/vaxtly.json` (mirrors the `update-homebrew` pattern)
- **Snap Store**: Linux snap built by electron-builder and published to the `stable` channel on snapcraft.io during the build step (via `SNAPCRAFT_STORE_CREDENTIALS` secret). Snap updates are handled automatically by `snapd` on user machines.

### WebSocket Client (`services/websocket-client.ts`)
- Mirrors `mcp-client.ts` pattern: `connections: Map<string, ManagedConnection>` keyed by request ID (= connection ID)
- `connect(connectionId, config)` → resolves `{{variables}}` in URL and headers via active environment, creates `ws` WebSocket, pushes status events to renderer
- Auto-corrects `https://` → `wss://` and `http://` → `ws://` URL schemes
- `sendMessage(connectionId, data)` → substitutes `{{variables}}` in message data before sending, persists to `websocket_messages` table
- `disconnect(connectionId)` — calls `removeAllListeners()` before `ws.close()` to prevent event handler accumulation on reconnect; `disconnectAll()` called on `app.will-quit`
- Messages persisted to `websocket_messages` table, trimmed to `WS_MESSAGE_LOG_MAX` (500) per connection
- SSL verification respects `request.verify_ssl` setting
- Subprotocols parsed from comma-separated string

### Custom Syntax Theme (`lib/utils/syntax-theme.ts`)
- Tokyo Night-inspired blue/amber palette — avoids green/red to not clash with variable highlighting
- `darkSyntaxHighlight` / `lightSyntaxHighlight` — `HighlightStyle` instances used alongside `oneDarkTheme` (editor chrome only)
- Keys: blue, strings: amber, numbers: orange, booleans: cyan, keywords: lavender

### CodeMirror Variable Highlighting (`lib/utils/variable-highlight.ts`)
- `variableHighlight(getResolved)` → CodeMirror `Extension` (decoration + tooltip)
- Resolved variables: green text (`cm-var-resolved`), unresolved: red text (`cm-var-unresolved`)
- Hover tooltip shows value and source label

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+, | Open settings |
| Cmd/Ctrl+N | New draft request (in-memory, no collection) |
| Cmd/Ctrl+S | Save current request |
| Cmd/Ctrl+W | Close active tab (unless pinned) |
| Cmd/Ctrl+Enter | Send request |
| Cmd/Ctrl+B | Toggle sidebar |
| Cmd/Ctrl+L | Focus URL input (planned) |
| Ctrl+PageDown | Next tab |
| Ctrl+PageUp | Previous tab |
| F1 | Open user manual |

---

## App-Level Reactive Behaviors (`App.svelte`)

Five `$effect` hooks and three `onMount` listeners in `App.svelte` drive cross-cutting UX behaviors:

1. **Session save**: Watches `tabFingerprint` (tab IDs joined) + `activeTabId`, debounce-writes to `session.tabs.{workspaceId}` setting (skipped until initial restore completes via `sessionRestored` flag). Sessions are scoped per workspace. Draft tabs (`isDraft: true`) are excluded from persistence — they are transient by design. Using a derived fingerprint of tab IDs (not `.length`) prevents re-triggering on tab property mutations.
2. **Sidebar auto-reveal**: When active tab changes — request/websocket tabs (non-draft): expands ancestor tree nodes + switches sidebar to "collections"; environment tabs: switches sidebar to "environments"; MCP tabs: switches sidebar to "mcp". Draft tabs skip sidebar reveal since they have no collection/folder backing.
3. **Default environment auto-activation**: When a request tab becomes active, resolves the nearest `default_environment_id` (folder chain → collection) and activates it if different from current.
4. **Theme application**: Reads `app.theme` setting (`dark` | `light` | `system`), toggles `light` class on `<html>`. In `system` mode listens to `matchMedia('prefers-color-scheme: dark')` with cleanup.
5. **Text-size application**: Reads `app.text_size` setting (`sm` | `md` | `lg`), swaps the `text-size-sm` / `text-size-lg` class on `<html>` (`md` = no class, Tailwind defaults). See § Design System → Text Size System.
6. **Toast notifications**: `onMount` listener on `logPush` — filters `success: false` entries with `category === 'vault' || 'sync'` and calls `toastsStore.addToast()`. Also replays recent failures (within 30s) from `log.list()` on mount to catch auto-sync errors that fired before the renderer mounted. `<ToastContainer />` is mounted at root level.
7. **Vault health LED**: `environmentsStore.vaultHealthy` drives the EnvironmentSelector LED color — green when vault secrets loaded successfully, red when fetch failed, gray when no environment is active.
8. **Centralized conflict queue**: `onMount` listener on `syncConflict` — all sync IPC handlers (`sync:pull`, `sync:push-collection`, `sync:push-all`) push detected conflicts via `event.sender.send('sync:conflict', conflicts)`. App.svelte queues them in `conflictQueue` and renders a single `ConflictModal` for the first conflict, resolving sequentially. This replaces per-component conflict modals (e.g., RemoteSyncTab no longer handles conflicts locally).
9. **Orphaned collection queue**: `onMount` listener on `syncOrphanedCollections` — when `sync:pull` or auto-sync detects locally-synced collections missing from remote, they are queued in `orphanQueue`. `OrphanedCollectionModal` prompts to delete locally or keep unsynced (deferred while conflicts are being resolved).
10. **Clipboard cURL detection**: `onMount` listener on `clipboardText` — main process checks `clipboard.availableFormats()` on BrowserWindow `'focus'` event (skips non-text formats to avoid triggering OS lazy data transfers for large files/images), reads `clipboard.readText()` with try-catch, caps at 100 KB, and pushes text to renderer. Renderer also enforces the 100 KB limit, checks via `isCurlCommand()`, deduplicates by content hash (same cURL won't re-prompt after import/dismiss), parses via `parseCurl()`, and shows `CurlImportModal`. Import creates a populated draft tab. cURL can also be pasted directly into the URL bar (intercepted by `RequestBuilder.handleUrlPaste`).

---

## Design System

### Theme System

Three-way theme: **dark** (default), **light**, **system** (follows OS preference).

- **CSS variable foundation** — `:root` defines ~30 semantic color variables (`--color-method-*`, `--color-success`, `--color-danger`, `--color-status-*`, `--color-var-*`, etc.) with dark-mode defaults. `html.light` overrides all of them for light mode, including flipping the `surface-*` scale and shifting `brand-*` darker.
- **No Tailwind class changes needed** — Tailwind `@theme` tokens (`surface-*`, `brand-*`) are overridden via CSS custom properties under `html.light`. All semantic colors (methods, status, feedback) use CSS variables through inline `style:color` or scoped `<style>` blocks.
- **Setting**: `app.theme` (`'dark' | 'light' | 'system'`), persisted in settings store.
- **Application**: `App.svelte` `$effect` toggles `light` class on `<html>`. System mode uses `matchMedia` listener with cleanup.
- **Main process**: `nativeTheme.themeSource` synced before window creation for correct `backgroundColor` and native dialog matching.
- **CodeMirror**: `Compartment` from `@codemirror/state` swaps `oneDark` ↔ `[]` reactively based on resolved theme.
- **UI**: Appearance section in GeneralTab (Light/Dark/System picker), theme cycle button in Sidebar footer.

### Text Size System

Three-tier UI font scale: **sm**, **md** (default), **lg** — each step is ±1px on every font size.

- **Tailwind tokens** — `html.text-size-sm` and `html.text-size-lg` override `--text-xs` through `--text-4xl` in `app.css`. Tailwind v4 compiles `text-xs`/`text-sm`/etc. to `font-size: var(--text-xs)`, so all Tailwind class-based sizes scale automatically.
- **Explicit pxs** — every literal `font-size: Npx` in component `<style>` blocks (modals, settings tabs, CodeMirror, splash) is written as `calc(Npx + var(--ui-bump))`. The presets set `--ui-bump` to `-1px` / `0` / `+1px`. New code must follow this convention or the text-size setting won't reach it.
- **Pinned exceptions** — the three buttons in the text-size picker itself (`.text-size-option--sm | --md | --lg` in `GeneralTab.svelte`) are intentionally fixed at 11/14/17 px so the picker is a stable visual reference, not affected by the active preset.
- **Setting**: `app.text_size` (`'sm' | 'md' | 'lg'`), default `'md'`, persisted in settings store.
- **Application**: `App.svelte` `$effect` swaps `text-size-sm`/`text-size-lg` class on `<html>` (md = no class).
- **UI**: Appearance → Text size row in GeneralTab, three A-shaped buttons styled like the theme picker.

### Color Tokens (Tailwind v4 `@theme`)

**Brand** (blue): `brand-50` through `brand-900` (based on blue-50..blue-900)
**Surface** (slate): `surface-50` through `surface-950` (based on slate-50..slate-950)

### HTTP Method Colors (CSS Variables)

All method colors are theme-aware via `--color-method-*` CSS variables. Components use `getMethodColor(method)` from `http-colors.ts` which returns `var(--color-method-*)` strings for inline `style:color`.

| Method | Dark | Light | CSS Variable |
|--------|------|-------|-------------|
| GET | `#4ade80` | `#16a34a` | `--color-method-get` |
| POST | `#22d3ee` | `#0891b2` | `--color-method-post` |
| PUT | `#60a5fa` | `#2563eb` | `--color-method-put` |
| PATCH | `#fb923c` | `#ea580c` | `--color-method-patch` |
| DELETE | `#f87171` | `#dc2626` | `--color-method-delete` |
| QUERY | `#a3e635` | `#65a30d` | `--color-method-query` |
| HEAD | `#c084fc` | `#9333ea` | `--color-method-head` |
| OPTIONS | `#94a3b8` | `#64748b` | `--color-method-options` |
| LIST | `#fbbf24` | `#d97706` | `--color-method-list` |
| WS | `#2dd4bf` | `#0d9488` | `--color-method-ws` |

### Status Code Colors (CSS Variables)
- 2xx: `--color-status-success`
- 3xx: `--color-status-redirect`
- 4xx: `--color-status-client-error`
- 5xx: `--color-status-server-error`

---

## Boot Sequence (`main/index.ts`)

```
0. fixPath (inline)              — Spawn login shell, capture only $PATH (macOS/Linux GUI launch gives minimal PATH; no-op on Windows; no secrets cross process boundary)
1. initEncryption()              — Load/create master key from OS keychain (vxk1: prefix, 0o600 perms)
2. openDatabase(dbPath)          — Open SQLite + run pending migrations
3. migrateToEncryptedStorage()   — One-time: encrypt existing plaintext sensitive data
4. ensureDefaultWorkspace()      — Create "Default Workspace" if table is empty
5. registerAllIpcHandlers()      — Register all domain handlers (incl. workspace-settings, session-log, code-generator, oauth2, updater, mcp, ws)
5b. agentSocket.start()          — Bind local Unix socket / named pipe + write ~/.vaxtly/cli.json so the bundled CLI / MCP wrapper can reach the running app (non-fatal on bind failure)
6. dropLegacyTables()            — DROP TABLE IF EXISTS request_histories (feature removed)
7. scrubVaultSecrets()           — UPDATE environments SET variables='[]' WHERE vault_synced=1 AND variables!='[]' (safety net for orphaned secrets)
8. buildMenu()                   — Set native application menu (using IPC.MENU_* constants)
9. initUpdater()                 — Configure electron-updater (no-op in dev; macOS: notify only; Win/Linux: auto-download)
10. applyThemeSetting()           — Read app.theme, set nativeTheme.themeSource + resolve backgroundColor
11. createWindow()               — BrowserWindow (sandbox: true, CSP, navigation guards, permission deny-all, focus→clipboard push with format check + 100KB cap)
12. runAutoSync()                — On ready-to-show: iterates all workspaces, resolves effective auto_sync setting (workspace → global fallback), runs vault pullAll + git pull per workspace
13. checkForUpdates()            — On ready-to-show: check for available updates
```

---

## Security Hardening

### Electron
- **Sandbox**: `sandbox: true` — preload runs in sandboxed context (only `contextBridge` + `ipcRenderer`)
- **CSP**: `<meta http-equiv="Content-Security-Policy">` — `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `frame-src blob:`
- **Navigation**: `will-navigate` blocked, `setWindowOpenHandler` returns `deny`
- **Permissions**: `setPermissionRequestHandler` denies all (camera, mic, geolocation, etc.)
- **DevTools**: `reload`, `forceReload`, `toggleDevTools` menu items only shown in dev mode
- **macOS entitlements**: only `allow-jit` (removed `allow-unsigned-executable-memory`, `allow-dyld-environment-variables`)
- **Test guard**: `VAXTLY_TEST_USERDATA` env var only honored when `!app.isPackaged`

### IPC Validation
- **Settings**: readonly key denylist (`encryption.*`, `app.version`), sensitive keys (`vault.token`, etc.) filtered from `getAll`
- **Proxy**: URL scheme whitelist (http/https), timeout clamped 1-300s, response body 50MB limit, form-data file paths checked against dialog-approved set. Any HTTP method string accepted (uppercased)
- **Data import**: replaced arbitrary `data:read-file` with dialog-based `data:pick-and-read`, JSON import size capped at 50MB
- **Vault migrate**: path traversal blocked (`..`, leading `/`)
- **Sync**: conflict resolution value strictly validated

### Encryption
- AES-256-GCM with 12-byte IV and 16-byte auth tag (authenticated encryption)
- Legacy AES-256-CBC data decrypted transparently (backward compat)
- `basic_username` added to encrypted auth fields

### Vault Secret Isolation (three-layer protection)
- **Toggle-time**: `EnvironmentEditor.toggleVaultSync()` clears DB `variables` to `'[]'` in both directions (enable and disable) — prevents orphaned secrets and vault-to-DB leakage
- **Service-level**: `pushVariables()` scrubs DB `variables` after successful Vault push if non-empty
- **Boot-time**: SQL scrub on startup clears any vault-synced environments with non-empty `variables` (safety net for pre-fix databases)

### Other
- **HtmlPreview**: blob: URL with empty sandbox (no scripts, no same-origin access)
- **SSL default**: `VERIFY_SSL: true` for new installs; check uses `!== 'false'` (secure by default)
- **Code generator**: `esc()` escapes backslashes and newlines; JS/Node body always string literals (no code interpolation)
- **YAML import**: UUID format validation on all imported entity IDs
- **Script execution**: per-chain stack (no global race condition), no debug log leaking body/headers
- **Error responses**: `error.message` only (no stack traces), session log uses template URL (no resolved secrets)

---

## Build Configuration

- **electron-builder.yml**: configures packaging for macOS (dmg/zip), Windows (nsis), Linux (AppImage/deb/snap)
- **`asarUnpack`**: `better-sqlite3` native module unpacked from asar archive (required for native addons)
- **Icons**: `build/icon.icns` (macOS), `build/icon.ico` (Windows), `build/icon.png` (Linux 512×512)
- **Linux `artifactName`**: includes `${arch}` for multi-architecture builds
- **macOS notarization**: `build/notarize.js` (CJS) — runs `@electron/notarize` as afterSign hook; errors propagate to fail the build
- **Dependencies**: `uuid` pinned to v9 (CJS-compatible; v13+ is pure ESM, incompatible with Electron main process)
- **CLI bundle**: `cli/dist/` produced by `tsc -p cli/tsconfig.json` and shipped via `extraResources` → `<resourcesPath>/cli/index.js`. The compiled bundle is plain Node (CJS), no Electron APIs; loaded by `vaxtly install-cli` and never required by the renderer.

---

## Agent Socket (Local CLI / MCP Surface)

A loopback-only RPC server inside the main process so the bundled `vaxtly` CLI (and its `vaxtly mcp` mode) can upsert entities into the running app from outside Electron. Designed for AI coding agents that have just helped a developer build an API and want to mirror it into Vaxtly.

### Transport
- **POSIX**: Unix domain socket at `<userData>/agent.sock` (mode 0700 via userData dir).
- **Windows**: named pipe `\\.\pipe\vaxtly-agent-<sha1-of-userData>`. Per-user ACL via OS.
- **No TCP listener.** Browser code cannot reach it.

### Auth
- Per-launch 32-byte random token, generated by `crypto.randomBytes`. Written to `~/.vaxtly/cli.json` (mode 0600) along with the socket path, pid, and app version. Rotated on every start; dotfile removed on `will-quit`.
- Every JSON-RPC request must include the token in the envelope (`req.auth`, not `req.params.auth` — that field is reserved for method params like a request's `AuthConfig`).
- Verified with `crypto.timingSafeEqual` per request. Mismatch → JSON-RPC error `-32001`.

### Wire Protocol
- Newline-delimited JSON-RPC 2.0 over the socket (`protocol.ts`).
- Method dispatch in `router.ts`; methods registered up-front in `agent-socket/index.ts`.
- Error codes: `-32700` parse, `-32600` invalid request, `-32601` method not found, `-32602` invalid params, `-32603` internal, `-32001` auth failed, `-32002` not found, `-32003` validation, `-32004` conflict.

### Methods

**Write (mutating):**
| Method | Idempotency key | Notes |
|--------|-----------------|-------|
| `upsert.collection` | `(workspace_id, external_key)` | Workspace defaults to first if not provided |
| `upsert.folder` | `(collection_id, external_key)` | `parent_folder_external_key: null \| ""` = collection root |
| `upsert.request` | `(collection_id, external_key)` | Folder moves within a collection are valid updates. Auth credentials encrypted by the repo (`enc:` prefix) |
| `upsert.env` | `(workspace_id, external_key)` | `parent_external_key` must exist; depth capped at 2 by env repo's `validateParent`. Passing `variables` REPLACES the array entirely (not a merge) — for single-var changes use `upsert.env_variable` |
| `upsert.env_variable` | `(env_external_key, key)` | Single-var safe path: add or update ONE variable inside an existing env without disturbing the others. Necessary because reads redact values, so agents can't safely re-pass a full array |

**Adoption (`id` param).** The four entity upserts (`collection`/`folder`/`request`/`env`) accept an optional `id`. Entities created in the UI have `external_key = NULL`, so a key-based upsert can't find them and would duplicate. Passing the entity's UUID (from the matching `list.*`) plus the desired `external_key` adopts the existing row: it's looked up by id, scope-checked (right workspace/collection), and its `external_key` is written so future key-based upserts resolve it. Refuses with `-32004` (conflict) if that key already belongs to a different row in the same scope. Shared logic in `_resolvers.ts → resolveUpsertTarget`.

**Read (always redacted):**
| Method | Returns |
|--------|---------|
| `ping` | `{ pong, app_version }` |
| `list.workspaces` | `[{id, name}]` |
| `list.collections` | `[{id, external_key, name, description}]` |
| `list.folders` | `[{id, external_key, name, parent_external_key}]` |
| `list.requests` | `[{id, external_key, name, method, url, folder_external_key}]` |
| `list.envs` | `[{id, external_key, name, is_active, vault_synced, parent_external_key}]` |
| `get.collection` / `get.folder` / `get.request` | Full entity with `auth` field sensitive subfields replaced with `"<redacted>"` |
| `get.env` | Full entity with every `variables[].value` replaced with `"<redacted>"`; keys visible |

**Redaction is unconditional.** No flag, no MCP param, no opt-in to view plaintext secrets. The reasoning: anything in an agent's context can leak via prompt injection from another tool; if a user genuinely needs the agent to know a secret, they paste it manually — that's a deliberate choice. See `services/agent-socket/methods/_redact.ts`. Empty/null sensitive fields are preserved so callers can distinguish "configured" from "unset".

External keys live on a new column (`external_key TEXT`) on each table with partial unique indexes (`WHERE external_key IS NOT NULL`). Multiple NULLs allowed; uniqueness enforced only on the populated set.

### Live UI Refresh
The renderer caches collections/folders/requests/envs in module-level `$state` loaded once via `loadAll()`, so out-of-band writes over the socket would otherwise be invisible until an app restart. After a successful upsert commits, each write method calls `notifyAgentDataChanged({ workspaceId, kind })` (`services/agent-socket/notifier.ts`), which broadcasts the `agent:data-changed` push to every renderer window via `BrowserWindow.getAllWindows()` — the same broadcast pattern as `session-log` / `websocket-client`. `App.svelte` subscribes via `api.on.agentDataChanged`, filters to the active workspace, and coalesces bursts (an MCP run fires many upserts) into a single debounced reload: `kind: 'env'` → `environmentsStore.loadAll()`, all other kinds → `collectionsStore.loadAll()`. The push fires only on the agent-socket path; UI-originated IPC mutations already self-update their stores, so there is no double reload.

### Actions Layer (`src/main/actions/`)
Centralizes "mutate → mark dirty" pairings so the agent-socket methods and the existing IPC handlers stay aligned. `actions/requests.ts` wraps `requestsRepo.{create,update,delete,move,reorder}` with `collectionsRepo.markDirty()`; other domains pass through. Both surfaces call the same actions function — adding new sync/audit side effects only needs to be done once.

### Lifecycle
- `start()` called in `app.whenReady()` after `registerAllIpcHandlers()` (depends on DB + encryption being live). Stale socket file unlinked on start.
- `stop()` called from `app.on('will-quit')` alongside MCP / WebSocket / GraphQL disconnects. Server closed, socket file removed, dotfile removed, in-memory token zeroed.
- Failure to bind is non-fatal — logged and the rest of the app continues.

### Files
- `services/agent-socket/index.ts` — server lifecycle + socket path resolution
- `services/agent-socket/auth.ts` — token gen, dotfile read/write, `verifyToken`
- `services/agent-socket/protocol.ts` — NDJSON framing + JSON-RPC envelope types + `LineBuffer`
- `services/agent-socket/router.ts` — `registerMethod` / `dispatch` / `HandlerError`. Reads token from `req.auth` (envelope), not `req.params.auth`
- `services/agent-socket/methods/_resolvers.ts` — translate external keys to UUIDs, with `HandlerError(NOT_FOUND)` on miss; `resolveUpsertTarget` handles key-based lookup vs `id`-based adoption
- `services/agent-socket/methods/_redact.ts` — `redactAuthJson` + `redactVariablesJson`, called by every `get.*` handler before returning
- `services/agent-socket/notifier.ts` — `notifyAgentDataChanged`, broadcasts the `agent:data-changed` push to renderer windows after a write commits (live UI refresh)
- `services/agent-socket/methods/{ping,upsert-collection,upsert-folder,upsert-request,upsert-env,upsert-env-variable}.ts`
- `services/agent-socket/methods/list-{workspaces,collections,folders,requests,envs}.ts` — slim navigation shapes
- `services/agent-socket/methods/get-{collection,folder,request,env}.ts` — full entity with sensitive fields redacted
- `cli/src/**` — the user-facing CLI, compiled via `npm run build:cli` into `cli/dist/`. Includes `cli/src/help.ts`, `cli/src/guide.ts` (long-form agent guide printed by `vaxtly guide`), and `cli/src/mcp/server.ts` which exposes 15 MCP tools mirroring the socket methods (`vaxtly mcp`).


## Build & Test Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Hot-reload dev server (electron-vite dev) |
| `npm run build` | Production build → `out/` (runs `build:cli` first) |
| `npm run build:cli` | Compile `cli/src` → `cli/dist` (tsc, CJS, plain Node — not Electron) |
| `npm run test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |



