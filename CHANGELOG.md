# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.10.0] - 2026-05-08

### Added
- Parent/child environments — an env can inherit from a parent so children override only what differs (e.g. one root env with `local` and `prod` children sharing common values)
- "Inherits from" picker in the environment editor; sidebar renders children indented under their parent
- "Used by" pills on root envs link to each child; children's editor shows an "Inherited from {parent}" table with per-row Override action
- Vault-aware inheritance — activating a child whose parent is vault-synced fetches both ends of the chain and reports per-env failures

### Changed
- Variable resolution merges parent → child → collection; disabled child entries are ignored, so the parent value applies (override with an explicit value to suppress)
- Mirror-back from post-response scripts walks active → parent and writes to the first env that already defines the key
- Deleting a parent orphans its children (they remain as their own root envs with values intact)

## [0.9.0] - 2026-04-16

### Added
- Collection/folder auth inheritance — set auth (bearer, basic, api-key, oauth2) at the collection or folder level; requests default to "Inherit from Parent" and walk the folder chain
- Collection/folder settings editor tab — replaces modals with a proper tabbed view (Auth, Environments, Scripts, Variables) opened from sidebar context menu
- Collection/folder pre-request and post-response scripts — configure token fetch once at the collection level, runs before every request
- Smart token caching ("Only fetch when needed") — skips token endpoint when cached token hasn't expired (30s safety margin)
- "Set Token Expiry" post-response action — converts `expires_in` (seconds) to absolute timestamp for use with smart caching
- Environment variable support in collection/folder auth inputs ({{variable}} highlighting)
- Sensitive data scanner now checks collection/folder auth fields during sync

### Changed
- New requests default to "Inherit" auth type instead of "No Auth"
- Sidebar context menu: "Set Environments" and "Set Auth" replaced with single "Settings" item

## [0.8.10] - 2026-04-10

### Changed
- New collections now appear at the top of the sidebar instead of the bottom

### Fixed
- Removed redundant Actions artifact upload from build workflow

## [0.8.9] - 2026-03-23

### Added
- .env file import: import environment variables from a `.env` file via the sidebar import button — supports quoted values, comments, `export` prefix, and escape sequences

### Fixed
- Tab bar now supports window dragging on macOS — drag empty space to move the window, double-click to open a new draft (JS-based drag via IPC, no CSS `app-region` conflicts)
- Pre-existing `tsconfig.node.json` error: removed `electron.vite.config.ts` from include (lives outside `rootDir`)

## [0.8.8] - 2026-03-16

### Fixed
- Code snippet modal: clipboard copy now works reliably in Electron (added fallback for modal focus issues)
- Code snippet modal: request body, auth, and other data now correctly included in generated code (Svelte 5 reactive proxies serialized via `$state.snapshot()` before IPC)

## [0.8.7] - 2026-03-14

### Added
- Response assertions (Tests): define assertions on status, headers, JSON paths, and response time with 9 operators — results shown in a new Tests tab in the response viewer
- Collection runner: execute all requests in a collection sequentially via right-click context menu, with progress modal and pass/fail based on assertions
- Cookie jar: in-memory RFC 6265 cookie store with automatic capture from Set-Cookie headers and injection on subsequent requests, viewer modal in sidebar footer
- GraphQL subscriptions: native `graphql-transport-ws` protocol support — auto-detects `subscription` keyword, Subscribe/Unsubscribe button, live event stream display

## [0.8.6] - 2026-03-14

### Added
- Database migration 005: performance indexes on `updated_at` columns for collections, requests, and environments
- Database CHECK constraint enforcing vault-synced environments always have empty variables in DB
- Vitest v8 coverage reporting (`npm run test -- --coverage`)
- `postinstall` script for automatic `electron-rebuild` after `npm install`
- `substituteWith()` function for pre-resolved variable substitution (avoids N+1 DB lookups)

### Fixed
- WebSocket event handler accumulation — listeners now removed on disconnect before closing
- OAuth2 token refresh race condition — per-token-URL mutex prevents concurrent refresh requests
- OAuth2 callback server timeout not cleared on `server.listen()` failure
- Tab drag pointer event leak when component is destroyed mid-drag
- Session save effect firing on every tab property change — now tracks tab IDs only
- MCP client notification handlers not deregistered on disconnect
- Vault push errors in post-response scripts silently swallowed — now logged
- File path validation gap in form-data upload — paths are now single-use, reject traversal and symlinks
- GraphQL schema cache growing unbounded — LRU eviction at 20 entries
- MCP traffic log creating new arrays on every entry at capacity — uses splice instead
- Sidebar collection search triggering expensive tree rebuild on every keystroke — debounced (150ms)
- RequestBuilder header reconciliation re-running on every auth field keystroke — debounced (200ms)
- HTTP proxy resolving variables separately for each substitution — cached once per request
- Context menu missing ARIA roles and keyboard navigation (arrow keys, Home, End, autofocus)
- Modal missing focus trap, autofocus, and focus restore on close
- Sidebar search input missing `aria-label`
- Toast timer bookkeeping using 3 separate Maps — consolidated into single Map
- Encryption fallback silently storing master key as plaintext — now logs a warning

## [0.8.5] - 2026-03-10

### Added
- Custom CA certificates — trust a custom certificate authority (PEM format) for servers signed by internal CAs
- Client certificates (mTLS) — configure client certificate + private key for mutual TLS authentication
- Proxy support — route all HTTP requests through an HTTP/HTTPS proxy with optional username/password authentication
- No-proxy bypass — comma-separated host patterns (exact, wildcard `*.local`, suffix `.corp.com`, catch-all `*`) to skip the proxy
- Collapsible Proxy and Certificates sections in Settings → General (collapsed by default, auto-expand when configured)
- Proxy-specific error messages — clear feedback for proxy rejection, auth failures, and certificate format issues
- Centralized TLS/proxy helper (`tls-options.ts`) — all HTTP consumers share consistent cert loading and proxy dispatch
- 53 new tests: TLS options (36), fetch error proxy/cert messages (17)

### Fixed
- Clipboard cURL detection no longer freezes the app when the system clipboard contains very large content (e.g. copied files); main process now checks clipboard formats first and caps text reads at 100 KB

## [0.8.0] - 2026-03-10

### Added
- cURL import — paste a cURL command into the URL bar to auto-populate method, URL, headers, query params, body, and auth into the current request tab
- Clipboard cURL detection — when switching to Vaxtly with a cURL command in the clipboard, a modal prompts to import it as a new draft request (same cURL won't re-prompt after import or dismiss)
- OpenAPI export — right-click a collection and choose "Export as OpenAPI" to generate an OpenAPI 3.0.3 YAML spec with paths, tags, parameters, request bodies, and security schemes (sensitive credentials are never included)
- OpenAPI import — auto-detect and import OpenAPI 3.x or Swagger 2.x specs (JSON or YAML) from the Data tab, creating a collection with folders from tags, requests from path operations, and mapped auth/body/params
- File picker and drag-and-drop import now accept `.yaml` and `.yml` files alongside `.json`
- 85 new unit tests: cURL parser (36), OpenAPI export (23), OpenAPI import (26)

## [0.7.0] - 2026-03-08

### Added
- GraphQL schema introspection — fetch schema from endpoint for autocompletion and validation in the query editor
- GraphQL syntax highlighting via cm6-graphql CodeMirror extension
- Draggable divider between GraphQL query and variables panels
- Schema status indicator (loaded/error) with fetch/refresh button
- Environment variable substitution in introspection requests (URL and headers)
- GraphQL JSON envelope storage — query and variables stored together, backward compatible with bare query strings
- GraphQL body support in code generator and pre-request script execution
- 6 new tests for GraphQL code generation and script execution paths

## [0.6.0] - 2026-03-04

### Added
- WebSocket support — create WebSocket connections alongside HTTP requests in collections and folders
- Connect to `ws://` and `wss://` endpoints with custom headers and subprotocols
- Real-time message log with sent/received indicators, timestamps, and size
- JSON message composer with CodeMirror syntax highlighting, pretty-print, and format button
- JSON messages in the message log expand into syntax-highlighted CodeMirror viewers
- Environment variable substitution in WebSocket URLs, headers, and message payloads
- WebSocket messages persisted to database (up to 500 per connection)
- MCP Servers and WebSocket steps added to the Welcome Guide
- "Welcome Guide" option in Help menu to re-open the onboarding modal

## [0.5.8] - 2026-03-04

### Added
- AWS Secrets Manager endpoint override for LocalStack integration

### Fixed
- Vault sync toggle no longer wipes environment variables — enabling sync now pushes current values to vault before clearing the local database
- Collection sync toggle now auto-pushes to remote when enabling (with sensitive data scan), matching MCP server behavior

## [0.5.7] - 2026-03-03

### Fixed
- VarInput selection — double-click word selection, click-and-drag, and Cmd+A now work correctly in URL bar, headers, params, auth fields, and environment editor
- Variable tooltip hover — tooltip text is now selectable without disappearing on mouse movement

## [0.5.6] - 2026-03-03

### Added
- Custom HTTP method support — method selector is now a combobox; type any method (PURGE, LOCK, etc.) and press Enter to use it
- LIST added as a standard method preset with its own color (amber)
- Variable highlighting in environment editor — `{{var}}` references in variable values now show green/red text

### Changed
- Custom syntax highlighting theme (Tokyo Night-inspired) — blue/amber palette replaces default red/green to avoid clashing with variable highlighting colors
- Variable highlighting is now text-color only (no background pill) across all editors, URL bar, headers, auth fields, environment variables, and MCP server config
- Removed HTTP method whitelist from proxy — `undici.fetch()` accepts any method string

## [0.5.5] - 2026-03-03

### Added
- Synced delete prompt for MCP servers — when deleting a sync-enabled MCP server, a modal asks "Delete locally only" vs "Delete everywhere" (also deletes from remote repository)
- Synced delete prompt for environments — when deleting a vault-synced environment, a modal asks "Delete locally only" vs "Delete everywhere" (also deletes secrets from vault)
- Orphaned MCP server detection — on pull/auto-sync, locally-synced MCP servers missing from the remote repository are detected and prompt "Delete locally" vs "Keep locally" (disables sync)

## [0.5.4] - 2026-03-03

### Added
- Synced collection delete prompt — when deleting a sync-enabled collection, a modal asks "Delete locally only" (remote copy preserved) vs "Delete everywhere" (remote directory also deleted)
- Orphaned collection detection — on pull/auto-sync, locally-synced collections missing from the remote repository are detected and prompt "Delete locally" vs "Keep locally" (disables sync)

## [0.5.3] - 2026-03-02

### Added
- MCP inspector split-panel layout — resizable two-column view with input (Tools, Resources, Prompts) on the left and output (Response, Traffic, Notifications) on the right, matching the HTTP request builder's split layout
- Dedicated response pane showing tool call results, resource contents, and prompt messages alongside the input that triggered them

### Fixed
- MCP server HTTP/SSE connections failing with "TypeError: fetch failed" when both stdio and HTTP transport configs are saved — form now only sends active transport fields, preventing stale stdio values from overwriting HTTP config
- MCP stdio server failing to spawn on Windows with "spawn cmd.exe ENOENT" — now passes the full process environment to the child process (instead of the SDK's minimal subset missing COMSPEC, PATHEXT, etc.) and validates the working directory exists before spawning with a clear error message

## [0.5.2] - 2026-03-02

### Fixed
- MCP server transport config fields no longer cleared when switching transport types — previously, switching from stdio to HTTP and back required re-entering all stdio fields from scratch

## [0.5.1] - 2026-02-28

### Fixed
- Resolve shell PATH for MCP stdio server spawning on macOS and Linux when launched from Finder/Dock/desktop (fixes `spawn npx ENOENT` errors caused by minimal GUI PATH missing nvm, volta, Homebrew, etc.)

## [0.5.0] - 2026-02-28

### Added
- MCP server testing — connect to MCP servers and inspect their capabilities natively within Vaxtly
  - Three transport types: stdio (local process), Streamable HTTP, and legacy SSE
  - Full MCP primitive support: Tools (list, call with dynamic JSON Schema forms), Resources (list, read), and Prompts (list, get with arguments)
  - Real-time traffic log showing all JSON-RPC messages with expandable params/results
  - Server notification feed with method and payload inspection
  - Inspector tab with sub-tab navigation: Tools, Resources, Prompts, Traffic, Notifications
  - Connect/disconnect to multiple MCP servers simultaneously
  - Auto-refresh on server-side list_changed notifications for tools, resources, and prompts
- MCP server git sync — sync server configurations to the same Git remote as collections, with auto-push on save, pull on startup, and sensitive data scanning
- MCP server variable substitution — configuration fields support `{{variable}}` references resolved at connect time from the active environment
- MCP server export/import — export individual servers via right-click → Export, export all from Settings → Data, and import from any Vaxtly export file
- Pull from Remote for individual MCP servers via right-click context menu
- Sidebar mode selector dropdown — header label is now a clickable dropdown for switching between Collections, Environments, and MCP Servers
- "MCP Servers" export option in Settings → Data alongside Collections, Environments, and Config

### Fixed
- Vault sync subtitle now says "your secret manager" instead of hardcoding "HashiCorp Vault" (both HashiCorp Vault and AWS Secrets Manager are supported)
- Auto-generated header badge ("AUTO") no longer breaks key-value column alignment
- Sensitive data scanning and VarInput vertical alignment

## [0.4.9] - 2026-02-27

### Added
- SSE streaming response support — auto-detects `text/event-stream` responses and streams them in real-time with a live status bar, Events tab, and real-time body accumulation
- SSE parser service with spec-compliant handling of multi-line data, event types, comments, and partial chunk buffering
- Events tab in response viewer with auto-scrolling event table, scroll-lock, and event count badge
- CodeEditor append-only mode for efficient streaming content updates
- SSE parser unit tests (22 test cases including OpenAI/Anthropic streaming formats)

## [0.4.8] - 2026-02-27

### Fixed
- Sidebar not updating after autosync pulls new collections — added IPC notification so the renderer reloads the collection tree immediately

## [0.4.7] - 2026-02-26

### Changed
- Parallelize GitLab/GitHub sync pull — eliminate redundant API calls and fetch files concurrently, significantly reducing sync time for repos with multiple collections

## [0.4.6] - 2026-02-26

### Fixed
- macOS ARM64 (Apple Silicon) build producing wrong-architecture binary — native modules now explicitly rebuilt for Electron's ABI on all platforms

## [0.4.5] - 2026-02-25

### Fixed
- Sync pull on a single collection now force-pulls even when the collection is dirty, clearing the dirty state instead of silently doing nothing
- All sync pull/push paths now log to the session log (pullSingleCollection early returns, pushSingleRequest conflicts and errors were previously silent)
- Sync conflict modal now appears reliably on all push paths — IPC handlers push conflicts to the renderer via centralized queue instead of relying on callers to check return values
- Removed duplicate conflict modal in RemoteSyncTab (conflicts now handled exclusively by the centralized queue in App.svelte)

### Added
- Sync IPC handler tests for conflict surfacing via event.sender.send (sync-handlers.test.ts)
- Sync service logging tests with mocked git providers (sync-service-logging.test.ts)
- Draft request e2e tests — lifecycle, send without save, collection picker, persistence, double-click (draft-requests.spec.ts)

## [0.4.4] - 2026-02-25

### Added
- Draft requests — Cmd+N (or double-click empty tab bar space) creates an in-memory scratchpad request with no collection. Edit, send, and test freely. Cmd+S opens a collection picker to save. Drafts are transient and lost on restart.
- Sync conflict detail — conflict resolution modal now shows which collections, folders, and requests changed locally vs remotely, with method badges and +/~/- change indicators

### Changed
- Sensitive data scanner uses unified body scanning — form-data, urlencoded, and JSON bodies all go through the same key-value detection path instead of branching by body type

## [0.4.3] - 2026-02-24

### Fixed
- v0.4.2 release build missing drag-and-drop tab reordering code

## [0.4.2] - 2026-02-24

### Added
- Drag-and-drop tab reordering — drag tabs left or right to rearrange them, with animated gap preview showing the drop position
- Splash screen with live status updates during startup — frameless branded window appears instantly on launch, showing initialization progress before the main window is ready

## [0.4.1] - 2026-02-24

### Added
- Editable auto-generated headers — Content-Type and Authorization headers now appear inline in the headers editor with an "auto" badge and can be toggled on/off or edited directly, instead of being read-only
- Expandable HTTP detail in session log — click any HTTP log entry to inspect full request (URL, query params, headers, body) and response (status, timing, headers, body, cookies) with tabbed detail panel
- Bulk edit for form-data entries — same `key:value` textarea interface as other key-value editors, with file entries shown as read-only markers

## [0.4.0] - 2026-02-24

### Added
- OAuth 2.0 authentication — Authorization Code + PKCE, Client Credentials, and Password grant types with auto-refresh, encrypted token storage, and full UI panel
- Insomnia import — parse v4 JSON exports (workspaces, folders, requests, environments) with auto-detection alongside existing Postman support
- Code generation for Go, Ruby, C#, and Java (9 languages total)
- Bulk edit mode for all key-value editors (headers, params, environments, URL-encoded, form-data) — toggle to a plain-text textarea with `key:value` format for fast multi-entry input and copy/paste between editors
- HTTP request/response detail in session log — click any HTTP log entry to expand and inspect full request (URL, query params, headers, body) and response (status, timing, size, headers, body, cookies) with Request/Response tabs
- Content dot indicators on Body, Auth, and Scripts tabs to show when they have content

### Fixed
- Environment editor losing unsaved changes on tab switch — state now cached in app store
- Request sub-tab resetting to Params on tab switch — active sub-tab now persisted in tab state
- Environment tab not refreshing after post-response scripts update variables — now explicitly syncs the open env tab after request send, including vault-synced environments
- Format button (JSON/XML) not updating the CodeMirror editor — `$effect` dependency tracking was broken by short-circuit evaluation when `view` was uninitialized; now uses `$state` for the editor view reference
- Pre-request script logs showing raw template URLs (e.g. `{{domain}}`) instead of resolved values — now logs the substituted URL

## [0.3.2] - 2026-02-23

### Fixed
- URL-encoded body rows deleted instead of disabled when unchecking — now stores entries as JSON to preserve enabled/disabled state
- Query params not syncing to the URL bar or being sent in requests when the URL contains template variables or non-standard formats
- "Check for Updates" menu action giving no feedback — now shows toast notifications for checking, up-to-date, and error states
- Snap installs not detected as package-managed — prevented auto-download and shows `sudo snap refresh vaxtly` in the update banner

## [0.3.1] - 2026-02-22

### Added
- Self-hosted GitHub Enterprise and GitLab instance support — optional Instance URL field in Remote Sync settings derives the correct API path automatically
- `rebuild:electron` and `rebuild:node` npm scripts for native module rebuilds

### Changed
- Clicking an environment name in the sidebar now toggles it active/inactive and opens its editor tab

### Fixed
- Environment editor not reflecting active state when activated from the sidebar

## [0.3.0] - 2026-02-22

### Added
- AWS Secrets Manager as alternative secrets provider — configure in Settings > Vault with Region, Profile, or Access Key credentials; supports the same sync workflow as HashiCorp Vault

### Changed
- In-app manual replaced with browser link to vaxtly.app/docs

### Fixed
- "Pull from Vault" button returned stale cached data instead of fetching fresh secrets — now clears the in-memory cache before fetching
- "Pull from Vault" not generating a session log entry — now logs success/failure with the environment name

## [0.2.5] - 2026-02-21

### Added
- Toast notifications for vault and git sync failures — liquid glass cards with category icons, countdown progress bar, and hover-to-pause
- Vault secret pre-fetch on environment activation — secrets are loaded eagerly when switching to a vault-synced environment instead of waiting for the first request
- Vault health LED in environment selector — green dot turns red when vault secrets fail to load, providing immediate visual feedback

### Removed
- Request history feature — removed `request_histories` table, History tab in SystemLog, and history retention setting from General settings. Session-level logs (method, status, URL, timing) remain in the Logs panel. Existing `request_histories` tables are dropped on upgrade.

### Fixed
- Toggling vault sync on did not clear existing local variables from the DB — encrypted secrets remained orphaned in the `variables` column. Now cleared at toggle time, after successful push, and as a boot-time safety scrub for existing users.
- Toggling vault sync off could leak in-memory vault secrets into the DB on next save — now clears variables in both directions and resets the editor to an empty row.
- SSL verification toggle showing "off" on fresh install while requests actually verified SSL — UI default now matches runtime default (`true`).

### Changed
- CodeEditor defers CodeMirror initialization via `requestIdleCallback` to avoid blocking the main thread on mount
- EnvironmentSelector computes dropdown position in `requestAnimationFrame` instead of synchronous `getBoundingClientRect()` in the click handler
- `environments:activate` IPC now returns `{ vaultFailed: boolean }` for vault-synced environments

## [0.2.4] - 2026-02-21

### Changed
- SystemLog now shows resolved URLs (e.g. `https://domain.com/post`) instead of raw `{{variable}}` templates for HTTP entries
- SystemLog text no longer truncates — rows scroll horizontally with a thin scrollbar when content is wide

## [0.2.3] - 2026-02-21

### Changed
- Variable resolution IPC handlers now call `ensureLoaded()` for vault-synced environments — variable highlighting updates immediately without needing to send a request first
- Pre/post-request script logs use a dedicated "script" category badge with "pre"/"post" type instead of "http" / "pre-script"
- Error responses show a clean centered error card instead of duplicating the error in both the status bar and the response body

### Fixed
- `{{variable}}` highlighting (green/red) not updating for vault-synced environments until after the first request send
- Git sync pushing encrypted `enc:gcm:...` ciphertext instead of original auth values (e.g. `{{token}}`) — affected both single-request and collection-level push
- SystemLog showing internal UUIDs instead of request names for pre/post-request script entries

### Added
- 2 regression tests for YAML serializer auth decryption (373 total)

## [0.2.2] - 2026-02-21

### Changed
- Vault-synced environment secrets are now held in-memory only — never written to the local SQLite database
- Vault environments store `variables: '[]'` in DB; actual secret values live in a session-lifetime in-memory cache
- Proxy handler calls `ensureLoaded()` before variable substitution to handle cold-cache scenarios
- Post-response script mirroring updates in-memory cache (and pushes to Vault) for vault-synced environments instead of writing to DB
- Environment editor saves vault-synced variables directly to Vault without local DB write

### Added
- `getCachedVariables(envId)`, `setCachedVariables(envId, vars)`, `ensureLoaded(envId, wsId?)` — in-memory vault secret cache API
- 30 new tests: unit tests for cache operations, vault-synced variable resolution, script mirroring, and 12 end-to-end integration tests covering fresh install and app-reopen flows (373 total)

### Fixed
- macOS update banner overlapping traffic light buttons (close/minimize/maximize)
- Update banner copy button not copying the command to clipboard

## [0.2.1] - 2026-02-21

### Changed
- macOS tab bar pills are now vertically centered within the title bar region

### Fixed
- macOS crash on reopen from dock — closing all windows shut down the database; reopening via dock icon then failed with "Database not initialized"

## [0.2.0] - 2026-02-21

### Added
- Liquid glass desktop redesign — unified visual language with glass backgrounds, blur effects, and refined surface hierarchy across every component
- Draggable sidebar resize with persisted width
- Persisted request builder split position across sessions
- Pull-from-remote sync for individual folders and requests, with context menu actions
- Push single request to remote on save
- Sync target indicator in SystemLog
- 127 new tests for IPC handlers, sync providers, and vault provider (341 total)

### Changed
- All settings tabs, environment editor, association modal, and sidebar tree items restyled with glass treatment
- Dropdown styles unified across context menus, workspace switcher, and environment selector
- Light mode overhauled with theme-aware tint tokens for consistent hover/focus states
- Divider and border styling softened throughout the UI
- Remaining scoped CSS migrated to Tailwind utilities
- macOS title bar spacing reduced — tab bar now serves as the drag region, eliminating the empty gap above tabs

### Fixed
- Environment selector not updating when creating a new environment
- Environment selector dropdown rendering behind CodeMirror response body
- Context menus stacking on repeated right-clicks instead of closing the previous one
- Modals rendering behind parent backdrop-filter containment
- Double border appearing when SystemLog panel is expanded
- 1px layout shift between tabs caused by SystemLog overflow
- Vault auto-sync logging errors on startup when no vault is configured
- Sidebar scrollbar visibility and auto-scroll behavior when switching requests

## [0.1.5] - 2026-02-20

### Added
- Export single collection from sidebar context menu — downloads a JSON file compatible with the existing importer
- Feedback tab in Settings with Bug Report and Feature Request buttons linking to GitHub Issues
- "Report a Problem" option in the Help menu — opens bug report with OS and version pre-filled
- GitHub issue templates for bug reports and feature requests
- Sidebar scrolls to center the active request when switching tabs
- Whitelisted external URL opener for GitHub links via `shell.openExternal`

### Changed
- Send no longer auto-saves or syncs — only explicit Save (Ctrl+S) persists to DB and triggers git sync
- Environment editor header redesigned to match the request builder's pill-style URL bar
- Sidebar and log panel slightly enlarged for better visibility (sidebar width, footer toolbar, icons)

### Fixed
- Git sync no longer blocks request send — HTTP fires immediately, sync runs in background
- Repeated sends without changes no longer trigger unnecessary dirty marking or remote sync calls
- Collections can now be collapsed in the sidebar even when a request inside them is active

### Security
- Strip `{{...}}` template patterns from server response values in post-response scripts to prevent nested variable injection that could exfiltrate secrets

## [0.1.4] - 2026-02-20

### Added
- Light/Dark/System theme support — three-way toggle persisted in settings, CSS variable foundation with `html.light` overrides, CodeMirror theme swap via Compartment, native dialog matching via `nativeTheme.themeSource`
- Appearance section in Settings > General with Light/Dark/System picker
- Theme cycle button in sidebar footer (moon → sun → monitor)
- Custom method selector dropdown replacing native `<select>` in URL bar — colored LED dots, keyboard navigation, fixed positioning
- Sidebar footer toolbar with mode switching icons, layout toggle, expand/collapse all, and settings shortcut
- Content Security Policy meta tag on renderer HTML
- Electron sandbox, navigation guards, permission request handler (deny all)
- IPC input validation: URL scheme whitelist, HTTP method whitelist, timeout clamped 1–300s, response body 50MB limit, form-data file paths checked against dialog-approved set, import JSON size capped at 50MB
- Settings IPC: readonly key denylist (`encryption.*`, `app.version`), sensitive keys filtered from `getAll` responses
- Vault path traversal protection, sync conflict resolution validation, history retention clamped 1–365
- UUID format validation on all YAML-imported entity IDs
- `basic_username` added to encrypted auth fields

### Changed
- All ~50 hardcoded hex colors replaced with theme-aware CSS variables (`--color-method-*`, `--color-success`, `--color-danger`, etc.)
- POST method color changed from yellow to cyan for better readability in both themes
- Dark mode background darkened for a deeper feel
- Encryption upgraded from AES-256-CBC to AES-256-GCM with authenticated encryption (existing CBC data decrypted transparently)
- SSL verification now defaults to on for new installs
- `data:read-file` IPC replaced with dialog-based `data:pick-and-read` — renderer can no longer specify arbitrary file paths
- HtmlPreview iframe uses blob: URL with empty sandbox instead of `allow-same-origin` + `doc.write()`
- Script execution uses per-chain stack instead of shared global (eliminates race condition)
- Error responses return `error.message` only (no stack traces); session log uses template URL (no resolved secrets)
- Code generator `esc()` now escapes backslashes and newlines; JS/Node body output uses string literals instead of code interpolation

### Fixed
- DevTools, reload, and force-reload menu items no longer available in production builds
- Removed overly broad macOS entitlements (`allow-unsigned-executable-memory`, `allow-dyld-environment-variables`)
- `VAXTLY_TEST_USERDATA` env var only honored in development builds
- Sensitive data scanner crash when headers or variables are non-array
- Git sync not triggered on request save (Ctrl+S) — collection `is_dirty` flag was never set on request mutations
- Auto-sync on startup not running for workspace-scoped settings — now resolves per-workspace with global fallback

## [0.1.3] - 2026-02-19

### Added
- Scoop package manager support for Windows — own bucket repo (`vaxtly/scoop-bucket`), CI auto-updates the manifest on release
- Install source detection (`getInstallSource()`) returning `'brew' | 'scoop' | 'standalone'`
- New IPC channel `update:install-source` exposed as `api.updater.installSource()`
- `update-scoop` CI job in `build.yml` (parallel with `update-homebrew`)

### Changed
- Update banner is now install-source-aware: Scoop installs show `scoop update vaxtly` with copy button, matching the existing Homebrew behavior on macOS
- Auto-download and quit-and-install are disabled for all package-managed installs (Homebrew + Scoop), not just macOS

## [0.1.2] - 2026-02-19

### Added
- 4 new unit test suites: encryption round-trip, fetch-error formatting, session-log ring buffer, proxy helper functions
- 77 new tests across 14 files (212 total, up from 135), covering encryption at rest, all auth/body types, workspace-scoped settings, code generator edge cases, and remote sync provider resolution
- 3 new E2E tests: HTTP 404/500 status codes, custom header verification (23 total, up from 20)

### Changed
- Exported `parseCookies`, `setDefaultHeader`, `deleteHeader` from `ipc/proxy.ts` for testability

### Fixed
- Environment selector not changing active environment — the auto-activate default environment effect was overriding user selections due to a reactive dependency loop

## [0.1.1] - 2026-02-19

### Added
- End-to-end testing with Playwright Electron API (20 tests across 7 spec files)
  - Smoke tests: window boot, sidebar, empty state
  - Keyboard shortcuts: Ctrl+N, Ctrl+W, Ctrl+B, Ctrl+,
  - Collection CRUD: create, rename, add request, delete
  - HTTP requests: GET/POST to local echo server, error handling
  - Settings modal: tab navigation, close via Escape and button
  - Environment variables: create, activate, `{{var}}` substitution in requests
  - Session persistence: tabs survive app restart
- Shared test fixtures: isolated temp userData per worker, local HTTP echo server
- `test:e2e` and `test:e2e:headed` npm scripts
- Shared `formatFetchError` utility with descriptive messages for SSL, DNS, connection, and timeout errors
- Vault `listSecrets` fallback strategy: tries KV v2 LIST, KV v2 GET, KV v1 LIST, KV v1 GET (works with both engine versions)
- Vault `testConnection` now verifies the configured mount exists via `/v1/sys/mounts`
- Vault settings: inline hints for Namespace and Engine Path fields
- Expanded Vault section in user manual with field-by-field configuration guide
- Save button in environment editor with Cmd/Ctrl+S support; auto-pushes to Vault when synced
- Drag-and-drop request moves now auto-sync affected collections when sync is enabled
- Sidebar auto-switches between Collections and Environments based on active tab type

### Changed
- Environment variables no longer auto-save on every keystroke — requires explicit Save
- Default verify SSL setting changed to off for new installs

### Fixed
- Vault "fetch failed" errors now show descriptive messages (SSL errors, DNS failures, connection refused, etc.) instead of generic "fetch failed"
- Vault namespace header (`X-Vault-Namespace`) no longer sent on data operations — only used during AppRole login. Fixes 404 errors when using namespaced Vault engines.
- Vault `testConnection` no longer swallows errors silently
- Vault push variables "object could not be cloned" error caused by Svelte 5 `$state` proxy crossing IPC boundary

## [0.1.0] - 2026-02-19

### Added
- Request builder with all HTTP methods, 7 body types (JSON, XML, form-data, urlencoded, raw, GraphQL), and 4 auth types (Bearer, Basic, API Key, none)
- Environment variables with `{{var}}` substitution and real-time CodeMirror highlighting
- Pre/post-request scripts with dependent request chains
- Request history auto-save with configurable retention
- Code generation for cURL, Python, PHP (Laravel), JavaScript (fetch), Node.js (axios)
- GitHub and GitLab git sync with 3-way merge and conflict resolution
- Sensitive data scanning before push
- HashiCorp Vault KV v2 integration with token and AppRole auth (auto-refresh, namespace support)
- Workspace-scoped sync and vault settings with global fallback
- Data export/import (collections, environments, config)
- Postman import (workspace dump, collection v2.1, environment)
- AES-256-CBC field-level encryption for sensitive data
- Auto-update notifications (macOS: brew upgrade prompt, Windows/Linux: auto-download with quit-and-install)
- Settings modal (General, Data, Remote Sync, Vault)
- Welcome guide, in-app user manual (F1), context menus
- Drag-and-drop sidebar reordering
- Session persistence scoped per workspace
- Cross-platform builds: macOS (dmg/zip + Homebrew), Windows (NSIS), Linux (AppImage/deb)
