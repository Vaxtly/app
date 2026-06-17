<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import Sidebar from './components/layout/Sidebar.svelte'
  import TabBar from './components/layout/TabBar.svelte'
  import RequestBuilder from './components/request/RequestBuilder.svelte'
  import EnvironmentEditor from './components/environment/EnvironmentEditor.svelte'
  import McpInspector from './components/mcp/McpInspector.svelte'
  import WsInspector from './components/websocket/WsInspector.svelte'
  import ContainerEditor from './components/container/ContainerEditor.svelte'
  import SystemLog from './components/layout/SystemLog.svelte'
  import SettingsModal from './components/settings/SettingsModal.svelte'
  import WelcomeGuide from './components/modals/WelcomeGuide.svelte'
  import WhatsNewModal from './components/modals/WhatsNewModal.svelte'
  import ToastContainer from './components/shared/ToastContainer.svelte'
  import ConflictModal from './components/modals/ConflictModal.svelte'
  import OrphanedCollectionModal from './components/modals/OrphanedCollectionModal.svelte'
  import CurlImportModal from './components/modals/CurlImportModal.svelte'
  import { isCurlCommand, parseCurl, type ParsedCurl } from '../shared/curl-parser'
  import type { SyncConflict, OrphanedCollection, OrphanedMcpServer, AgentDataChangedEvent } from './lib/types'
  import { appStore } from './lib/stores/app.svelte'
  import { collectionsStore } from './lib/stores/collections.svelte'
  import { environmentsStore } from './lib/stores/environments.svelte'
  import { mcpStore } from './lib/stores/mcp.svelte'
  import { wsStore } from './lib/stores/websocket.svelte'
  import { settingsStore } from './lib/stores/settings.svelte'
  import { toastsStore } from './lib/stores/toasts.svelte'

  // Track the active RequestBuilder for save/send shortcuts
  let activeBuilder = $state<{ save: () => Promise<void>; send: () => Promise<void> } | undefined>(undefined)
  let showWelcome = $state(false)
  let showWhatsNew = $state(false)

  /**
   * Open the WhatsNewModal iff there's an unseen version. Idempotent on
   * `app.last_seen_version` — once set to the current version, this is a no-op
   * until the next release. Called at boot (for existing users) and chained
   * after the WelcomeGuide closes (for brand-new users), so it fires at most
   * once per install / upgrade.
   */
  function maybeShowWhatsNew(): void {
    const currentVersion = settingsStore.get('app.version')
    const lastSeen = settingsStore.get('app.last_seen_version')
    if (currentVersion && currentVersion !== '0.0.0' && lastSeen !== currentVersion) {
      showWhatsNew = true
    }
  }
  let sessionRestored = $state(false)
  let sidebarDragging = $state(false)

  // --- Update notification state ---
  let updateAvailable: { version: string; releaseName: string } | null = $state(null)
  let updateDownloaded = $state(false)
  let updateProgress: number | null = $state(null)
  let updateDismissed = $state(false)
  let installSource: 'brew' | 'scoop' | 'snap' | 'standalone' = $state('standalone')
  let menuUpdateCheck = $state(false)

  // --- Clipboard cURL detection ---
  let curlDetected = $state<{ parsed: ParsedCurl; raw: string } | null>(null)
  let lastClipboardHash = ''

  function handleClipboardText(text: string): void {
    // Skip empty, oversized (>100 KB), or non-cURL clipboard content
    if (!text || text.length > 100_000 || !isCurlCommand(text)) return

    // Don't re-prompt for the same clipboard content
    const hash = text.trim()
    if (hash === lastClipboardHash) return
    lastClipboardHash = hash

    const parsed = parseCurl(text)
    if (!parsed.url) return
    curlDetected = { parsed, raw: text }
  }

  function handleCurlImport(): void {
    if (!curlDetected) return
    const { parsed } = curlDetected

    // Open a draft tab and populate it
    appStore.openDraftTab()
    const tab = appStore.activeTab
    if (!tab) return

    const newHeaders = parsed.headers.length > 0
      ? [...parsed.headers, { key: '', value: '', enabled: true }]
      : [{ key: '', value: '', enabled: true }]

    const newParams = (parsed as any).queryParams?.length > 0
      ? [...(parsed as any).queryParams, { key: '', value: '', enabled: true }]
      : [{ key: '', value: '', enabled: true }]

    appStore.updateTabState(tab.id, {
      method: parsed.method,
      url: parsed.url,
      headers: JSON.stringify(newHeaders),
      query_params: JSON.stringify(newParams),
      body: parsed.body,
      body_type: parsed.body_type,
      auth: parsed.auth ? JSON.stringify(parsed.auth) : null,
    })

    curlDetected = null
  }

  function dismissCurlDetection(): void {
    curlDetected = null
  }

  // --- Sync conflict state ---
  let conflictQueue = $state<SyncConflict[]>([])
  let activeConflict = $derived(conflictQueue.length > 0 ? conflictQueue[0] : null)

  // --- Orphaned collection state ---
  let orphanQueue = $state<OrphanedCollection[]>([])
  let activeOrphan = $derived(orphanQueue.length > 0 ? orphanQueue[0] : null)

  // --- Orphaned MCP server state ---
  let mcpOrphanQueue = $state<OrphanedMcpServer[]>([])
  let activeMcpOrphan = $derived(mcpOrphanQueue.length > 0 ? mcpOrphanQueue[0] : null)

  function dismissUpdate(): void {
    updateDismissed = true
  }

  let copyLabel = $state('Copy command')

  async function copyUpdateCommand(): Promise<void> {
    const cmds: Record<string, string> = { brew: 'brew upgrade vaxtly', scoop: 'scoop update vaxtly', snap: 'sudo snap refresh vaxtly' }
    const cmd = cmds[installSource] ?? 'brew upgrade vaxtly'
    try {
      await navigator.clipboard.writeText(cmd)
      copyLabel = 'Copied!'
      setTimeout(() => { copyLabel = 'Copy command' }, 2000)
    } catch {
      // Fallback for environments where clipboard API fails
      const el = document.createElement('textarea')
      el.value = cmd
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      copyLabel = 'Copied!'
      setTimeout(() => { copyLabel = 'Copy command' }, 2000)
    }
  }

  function restartToUpdate(): void {
    window.api.updater.install()
  }

  async function handleConflictResolve(resolution: 'keep-local' | 'keep-remote'): Promise<void> {
    if (!activeConflict) return
    try {
      const result = await window.api.sync.resolveConflict(activeConflict.collectionId, resolution, appStore.activeWorkspaceId ?? undefined)
      if (result.success) {
        await collectionsStore.loadAll(appStore.activeWorkspaceId ?? undefined)
      } else {
        toastsStore.addToast('sync', `Git sync: Resolution failed — ${result.message}`)
      }
    } catch (err) {
      toastsStore.addToast('sync', `Git sync: ${err instanceof Error ? err.message : 'Resolution failed'}`)
    }
    conflictQueue = conflictQueue.slice(1)
  }

  function dismissConflict(): void {
    conflictQueue = conflictQueue.slice(1)
  }

  async function handleOrphanResolve(resolution: 'delete' | 'keep'): Promise<void> {
    if (!activeOrphan) return
    try {
      const result = await window.api.sync.resolveOrphan(activeOrphan.collectionId, resolution)
      if (result.success) {
        await collectionsStore.loadAll(appStore.activeWorkspaceId ?? undefined)
      } else {
        toastsStore.addToast('sync', `Git sync: Orphan resolution failed — ${result.message}`)
      }
    } catch (err) {
      toastsStore.addToast('sync', `Git sync: ${err instanceof Error ? err.message : 'Resolution failed'}`)
    }
    orphanQueue = orphanQueue.slice(1)
  }

  function dismissOrphan(): void {
    orphanQueue = orphanQueue.slice(1)
  }

  async function handleMcpOrphanResolve(resolution: 'delete' | 'keep'): Promise<void> {
    if (!activeMcpOrphan) return
    try {
      const result = await window.api.sync.resolveMcpOrphan(activeMcpOrphan.serverId, resolution)
      if (result.success) {
        await mcpStore.loadServers(appStore.activeWorkspaceId!)
      } else {
        toastsStore.addToast('sync', `Git sync: MCP orphan resolution failed — ${result.message}`)
      }
    } catch (err) {
      toastsStore.addToast('sync', `Git sync: ${err instanceof Error ? err.message : 'Resolution failed'}`)
    }
    mcpOrphanQueue = mcpOrphanQueue.slice(1)
  }

  function dismissMcpOrphan(): void {
    mcpOrphanQueue = mcpOrphanQueue.slice(1)
  }

  // Active state for current environment tab (computed here so store
  // tracking works outside the {#key} block)
  let envTabActive = $derived(
    appStore.activeTab?.type === 'environment' &&
    environmentsStore.activeEnvironmentId === appStore.activeTab?.entityId
  )

  // --- Session persistence ---

  interface PersistedSession {
    tabs: Array<{ type: 'request' | 'environment' | 'mcp' | 'websocket'; entityId: string; pinned: boolean }>
    activeEntityId: string | null
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function saveSession(): void {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const persistedTabs = appStore.openTabs.filter((t) => !t.isDraft)
      const session: PersistedSession = {
        tabs: persistedTabs.map((t) => ({ type: t.type, entityId: t.entityId, pinned: t.pinned })),
        activeEntityId: appStore.activeTab?.isDraft ? null : (appStore.activeTab?.entityId ?? null),
      }
      const wsId = appStore.activeWorkspaceId
      const sessionKey = wsId ? `session.tabs.${wsId}` : 'session.tabs'
      window.api.settings.set(sessionKey, JSON.stringify(session))
    }, 500)
  }

  // Stable identity list — only changes on add/remove/reorder, not on tab property mutations
  let tabFingerprint = $derived(appStore.openTabs.map((t) => t.id).join(','))

  $effect(() => {
    // Only track tab IDs (add/remove/reorder) and active tab — not every property change
    void tabFingerprint
    void appStore.activeTabId
    if (sessionRestored) saveSession()
  })

  // Auto-reveal active tab's entity in the sidebar + apply default environment.
  // Only fires when the active tab ID actually changes — not on every re-evaluation
  // of activeTab (which re-fires when tab state is mutated, e.g. markTabSaved).
  // This lets users collapse collections without the effect fighting back.
  let lastRevealedTabId: string | undefined
  $effect(() => {
    const tabId = appStore.activeTabId
    if (!tabId || tabId === lastRevealedTabId) return
    lastRevealedTabId = tabId

    const tab = untrack(() => appStore.activeTab)
    if (!tab) return
    if (tab.type === 'request' && !tab.isDraft) {
      appStore.setSidebarMode('collections')
      collectionsStore.revealRequest(tab.entityId)

      // Scroll the request into view only if it's not already visible
      tick().then(() => {
        const el = document.querySelector(`[data-request-id="${tab.entityId}"]`)
        if (!el) return
        const scrollParent = el.closest('.sidebar-scroll')
        if (!scrollParent) return
        const parentRect = scrollParent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const isVisible = elRect.top >= parentRect.top && elRect.bottom <= parentRect.bottom
        if (!isVisible) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' })
        }
      })

      // Auto-activate default environment only on tab switch
      const defaultEnvId = collectionsStore.resolveDefaultEnvironment(tab.entityId)
      if (defaultEnvId) {
        const currentEnvId = untrack(() => environmentsStore.activeEnvironmentId)
        if (defaultEnvId !== currentEnvId) {
          environmentsStore.activate(defaultEnvId, appStore.activeWorkspaceId ?? undefined)
        }
      }
    } else if (tab.type === 'environment') {
      appStore.setSidebarMode('environments')
    } else if (tab.type === 'mcp') {
      appStore.setSidebarMode('mcp')
    } else if (tab.type === 'websocket') {
      appStore.setSidebarMode('collections')
      collectionsStore.revealRequest(tab.entityId)

      tick().then(() => {
        const el = document.querySelector(`[data-request-id="${tab.entityId}"]`)
        if (!el) return
        const scrollParent = el.closest('.sidebar-scroll')
        if (!scrollParent) return
        const parentRect = scrollParent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const isVisible = elRect.top >= parentRect.top && elRect.bottom <= parentRect.bottom
        if (!isVisible) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' })
        }
      })
    }
  })

  async function restoreSession(): Promise<void> {
    try {
      const wsId = appStore.activeWorkspaceId
      const sessionKey = wsId ? `session.tabs.${wsId}` : 'session.tabs'
      const raw = await window.api.settings.get(sessionKey)
      if (!raw) return
      const session: PersistedSession = JSON.parse(raw)
      if (!Array.isArray(session.tabs)) return

      for (const saved of session.tabs) {
        if (saved.type === 'request') {
          const req = collectionsStore.getRequestById(saved.entityId)
          if (req) {
            appStore.openRequestTab(req)
            if (saved.pinned) appStore.togglePinTab(`tab-${saved.entityId}`)
          }
        } else if (saved.type === 'environment') {
          const env = environmentsStore.getById(saved.entityId)
          if (env) {
            appStore.openEnvironmentTab({ id: env.id, name: env.name })
            if (saved.pinned) appStore.togglePinTab(`tab-env-${saved.entityId}`)
          }
        } else if (saved.type === 'mcp') {
          const server = mcpStore.servers.find((s) => s.id === saved.entityId)
          if (server) {
            appStore.openMcpTab({ id: server.id, name: server.name })
            if (saved.pinned) appStore.togglePinTab(`tab-mcp-${saved.entityId}`)
          }
        } else if (saved.type === 'websocket') {
          const req = collectionsStore.getRequestById(saved.entityId)
          if (req) {
            appStore.openWebSocketTab(req)
            if (saved.pinned) appStore.togglePinTab(`tab-ws-${saved.entityId}`)
          }
        } else if (saved.type === 'collection') {
          const col = collectionsStore.getCollectionById(saved.entityId)
          if (col) {
            appStore.openCollectionEditorTab({ id: col.id, name: col.name })
            if (saved.pinned) appStore.togglePinTab(`tab-col-${saved.entityId}`)
          }
        } else if (saved.type === 'folder') {
          const folder = collectionsStore.getFolderById(saved.entityId)
          if (folder) {
            appStore.openFolderEditorTab({ id: folder.id, name: folder.name })
            if (saved.pinned) appStore.togglePinTab(`tab-fld-${saved.entityId}`)
          }
        }
      }

      // Restore active tab
      if (session.activeEntityId) {
        const tab = appStore.openTabs.find((t) => t.entityId === session.activeEntityId)
        if (tab) appStore.setActiveTab(tab.id)
      }
    } catch {
      // Corrupted session data — start fresh
    }
  }

  // --- Theme application ---
  $effect(() => {
    const theme = settingsStore.get('app.theme')
    const html = document.documentElement

    function applyDark(isDark: boolean): void {
      if (isDark) {
        html.classList.remove('light')
      } else {
        html.classList.add('light')
      }
    }

    if (theme === 'light') {
      applyDark(false)
    } else if (theme === 'dark') {
      applyDark(true)
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyDark(mq.matches)
      const handler = (e: MediaQueryListEvent): void => applyDark(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  })

  // --- Text-size preset application ---
  $effect(() => {
    const size = settingsStore.get('app.text_size')
    const html = document.documentElement
    html.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg')
    if (size === 'sm' || size === 'lg') {
      html.classList.add(`text-size-${size}`)
    }
  })

  function handleRequestClick(requestId: string): void {
    const request = collectionsStore.getRequestById(requestId)
    if (request) {
      if (request.method === 'WEBSOCKET') {
        appStore.openWebSocketTab(request)
      } else {
        appStore.openRequestTab(request)
      }
    }
  }

  function handleEnvironmentClick(environmentId: string): void {
    const env = environmentsStore.getById(environmentId)
    if (env) {
      appStore.openEnvironmentTab({ id: env.id, name: env.name })
    }
  }

  function handleMcpServerClick(serverId: string): void {
    const server = mcpStore.servers.find((s) => s.id === serverId)
    if (server) {
      appStore.openMcpTab({ id: server.id, name: server.name })
    }
  }

  function handleNewRequest(): void {
    appStore.openDraftTab()
  }

  async function handleSave(): Promise<void> {
    if (activeBuilder) {
      await activeBuilder.save()
    }
  }

  async function handleSend(): Promise<void> {
    if (activeBuilder) {
      await activeBuilder.send()
    }
  }

  // Coalesce bursts of agent-socket (CLI / MCP) writes: an MCP run can fire
  // dozens of upserts back-to-back, so debounce and reload each affected store
  // at most once per quiet window instead of per write.
  let agentReloadTimer: ReturnType<typeof setTimeout> | null = null
  let agentReloadEnv = false
  let agentReloadCollections = false
  function handleAgentDataChanged(event: AgentDataChangedEvent): void {
    if (event.workspaceId !== appStore.activeWorkspaceId) return
    if (event.kind === 'env') agentReloadEnv = true
    else agentReloadCollections = true
    if (agentReloadTimer) clearTimeout(agentReloadTimer)
    agentReloadTimer = setTimeout(() => {
      agentReloadTimer = null
      const workspaceId = appStore.activeWorkspaceId
      if (!workspaceId) return
      if (agentReloadCollections) collectionsStore.loadAll(workspaceId)
      if (agentReloadEnv) environmentsStore.loadAll(workspaceId)
      agentReloadCollections = false
      agentReloadEnv = false
    }, 150)
  }

  onMount(async () => {
    // Detect install source (brew / scoop / standalone)
    installSource = await window.api.updater.installSource()

    // Load settings
    await settingsStore.loadAll()

    // Restore sidebar width
    const savedWidth = settingsStore.get('sidebar.width')
    if (savedWidth) appStore.setSidebarWidth(savedWidth)

    // Modal flow on launch:
    //
    //   First launch ever         → WelcomeGuide carousel → then WhatsNewModal
    //   First launch this version → WhatsNewModal only
    //   Subsequent launches       → neither
    //
    // The WhatsNewModal is the only thing that writes `app.last_seen_version`, so
    // its close handler is what "consumes" the upgrade signal. The chain is wired
    // in the template below: WelcomeGuide's onclose calls maybeShowWhatsNew(),
    // which re-evaluates fresh state (not a stale captured boot value) so that
    // re-opening WelcomeGuide later via the Help menu can't double-fire WhatsNew.
    if (!settingsStore.get('app.welcomed')) {
      showWelcome = true
    } else {
      maybeShowWhatsNew()
    }

    // Load workspaces and set default
    const workspaces = await window.api.workspaces.list()
    appStore.setWorkspaces(workspaces)
    if (workspaces.length > 0) {
      appStore.setActiveWorkspace(workspaces[0].id)
      await collectionsStore.loadAll(workspaces[0].id)
      await environmentsStore.loadAll(workspaces[0].id)
      await mcpStore.loadServers(workspaces[0].id)
      await restoreSession()
    }
    sessionRestored = true

    // Menu event listeners
    const cleanups = [
      window.api.on.menuNewRequest(handleNewRequest),
      window.api.on.menuSaveRequest(handleSave),
      window.api.on.menuOpenSettings(() => appStore.openSettings()),
      window.api.on.menuShowWelcome(() => { showWelcome = true }),
      window.api.on.menuCheckUpdates(() => {
        menuUpdateCheck = true
        toastsStore.addToast('update', 'Checking for updates…')
        window.api.updater.check()
      }),
      window.api.on.updateAvailable((data) => {
        if (menuUpdateCheck) menuUpdateCheck = false
        updateAvailable = data
        updateDismissed = false
      }),
      window.api.on.updateNotAvailable(() => {
        if (menuUpdateCheck) {
          toastsStore.addToast('update', 'You\'re on the latest version')
          menuUpdateCheck = false
        }
      }),
      window.api.on.updateProgress((data) => {
        updateProgress = data.percent
      }),
      window.api.on.updateDownloaded(() => {
        updateDownloaded = true
        updateProgress = null
      }),
      window.api.on.updateError((message) => {
        if (menuUpdateCheck) {
          toastsStore.addToast('update', `Update check failed: ${message}`)
          menuUpdateCheck = false
        }
      }),
      // Surface vault/git failures as toast notifications (skip conflicts — modal handles those)
      window.api.on.logPush((entry) => {
        if (!entry.success && (entry.category === 'vault' || entry.category === 'sync')) {
          if (entry.message.includes('Conflict detected')) return
          const label = entry.category === 'vault' ? 'Vault' : 'Git sync'
          toastsStore.addToast(entry.category, `${label}: ${entry.message}`)
        }
      }),
      window.api.on.syncConflict((conflicts) => {
        conflictQueue = [...conflictQueue, ...conflicts]
      }),
      window.api.on.syncOrphanedCollections((orphaned) => {
        orphanQueue = [...orphanQueue, ...orphaned]
      }),
      window.api.on.syncOrphanedMcpServers((orphaned) => {
        mcpOrphanQueue = [...mcpOrphanQueue, ...orphaned]
      }),
      window.api.on.syncPullComplete((workspaceId) => {
        if (workspaceId === appStore.activeWorkspaceId) {
          collectionsStore.loadAll(workspaceId)
          mcpStore.loadServers(workspaceId)
          environmentsStore.loadAll(workspaceId)
        }
      }),
      // CLI / MCP wrote data over the agent socket — refresh affected stores live
      window.api.on.agentDataChanged(handleAgentDataChanged),
      // MCP push events
      window.api.on.mcpStatusChanged((data) => mcpStore.handleStatusChanged(data)),
      window.api.on.mcpNotification((entry) => mcpStore.handleNotification(entry)),
      window.api.on.mcpTrafficPush((entry) => mcpStore.handleTrafficPush(entry)),
      window.api.on.mcpToolsChanged((data) => mcpStore.handleToolsChanged(data)),
      window.api.on.mcpResourcesChanged((data) => mcpStore.handleResourcesChanged(data)),
      window.api.on.mcpPromptsChanged((data) => mcpStore.handlePromptsChanged(data)),
      // WebSocket push events
      window.api.on.wsStatusChanged((data) => wsStore.handleStatusChanged(data)),
      window.api.on.wsMessageReceived((data) => wsStore.handleMessageReceived(data)),
      // Clipboard cURL detection (main pushes clipboard text on BrowserWindow focus)
      window.api.on.clipboardText(handleClipboardText),
    ]

    // Replay recent vault/git failures (covers auto-sync that fired before renderer mounted)
    const recentLogs = await window.api.log.list()
    const thirtySecondsAgo = Date.now() - 30_000
    for (const entry of recentLogs) {
      if (!entry.success && (entry.category === 'vault' || entry.category === 'sync')) {
        if (entry.message.includes('Conflict detected')) continue
        if (new Date(entry.timestamp).getTime() > thirtySecondsAgo) {
          const label = entry.category === 'vault' ? 'Vault' : 'Git sync'
          toastsStore.addToast(entry.category, `${label}: ${entry.message}`)
        }
      }
    }

    // Global keyboard shortcuts
    function handleKeydown(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        handleNewRequest()
      } else if (mod && e.key === 's') {
        e.preventDefault()
        handleSave()
      } else if (mod && e.key === 'w') {
        e.preventDefault()
        if (appStore.activeTabId) {
          appStore.closeTab(appStore.activeTabId)
        }
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      } else if (mod && e.key === 'b') {
        e.preventDefault()
        appStore.toggleSidebar()
      } else if (mod && e.key === ',') {
        e.preventDefault()
        appStore.openSettings()
      } else if (mod && e.key === 'l') {
        e.preventDefault()
        // Focus URL input — the active RequestBuilder will handle this
      } else if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault()
        appStore.nextTab()
      } else if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault()
        appStore.prevTab()
      }
    }

    document.addEventListener('keydown', handleKeydown)

    return () => {
      cleanups.forEach((fn) => fn())
      document.removeEventListener('keydown', handleKeydown)
      clearTimeout(saveTimer)
      if (agentReloadTimer) clearTimeout(agentReloadTimer)
    }
  })
</script>

<div class="flex h-screen flex-col bg-surface-900">
  <!-- Update notification banner -->
  {#if updateAvailable && !updateDismissed}
    {@const isMac = window.navigator.userAgent.includes('Macintosh')}
    <div class="update-banner" style={isMac ? 'padding-left: 78px' : ''}>
      {#if installSource === 'brew' || installSource === 'scoop' || installSource === 'snap'}
        {@const cmd = installSource === 'brew' ? 'brew upgrade vaxtly' : installSource === 'scoop' ? 'scoop update vaxtly' : 'sudo snap refresh vaxtly'}
        <span class="update-text">
          Vaxtly v{updateAvailable.version} is available — run
          <code class="update-code">{cmd}</code>
          to update
        </span>
        <button class="update-btn" onclick={copyUpdateCommand}>{copyLabel}</button>
      {:else if updateDownloaded}
        <span class="update-text">
          Vaxtly v{updateAvailable.version} is ready — restart to update
        </span>
        <button class="update-btn update-btn-primary" onclick={restartToUpdate}>Restart now</button>
      {:else if updateProgress !== null}
        <span class="update-text">
          Downloading Vaxtly v{updateAvailable.version}… {Math.round(updateProgress)}%
        </span>
        <div class="update-progress-track">
          <div class="update-progress-bar" style="width: {updateProgress}%"></div>
        </div>
      {:else}
        <span class="update-text">
          Vaxtly v{updateAvailable.version} is available
        </span>
      {/if}
      <button class="update-dismiss" onclick={dismissUpdate} aria-label="Dismiss">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M4 4l8 8M12 4l-8 8"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Main content: sidebar + tab area -->
  <div class="flex min-h-0 flex-1" class:select-none={sidebarDragging}>
    <!-- Sidebar -->
    {#if !appStore.sidebarCollapsed}
      <div class="shrink-0" style="width: {appStore.sidebarWidth}px">
        <Sidebar onrequestclick={handleRequestClick} onenvironmentclick={handleEnvironmentClick} onmcpserverclick={handleMcpServerClick} />
      </div>

      <!-- Sidebar resize divider -->
      <div
        class="sidebar-divider"
        class:sidebar-divider--dragging={sidebarDragging}
        role="separator"
        tabindex="-1"
        onpointerdown={(e) => {
          e.preventDefault()
          sidebarDragging = true
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onpointermove={(e) => {
          if (!sidebarDragging) return
          appStore.setSidebarWidth(e.clientX)
        }}
        onpointerup={() => {
          if (!sidebarDragging) return
          sidebarDragging = false
          settingsStore.set('sidebar.width', appStore.sidebarWidth)
        }}
        onpointercancel={() => {
          sidebarDragging = false
        }}
      ></div>
    {/if}

    <!-- Main area -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Drag region (non-Mac, sidebar collapsed — provides a small grab area) -->
      {#if !window.navigator.userAgent.includes('Macintosh') && appStore.sidebarCollapsed}
        <div class="drag-region h-2 shrink-0"></div>
      {/if}

      <!-- Tab bar -->
      <TabBar />

      <!-- Content area -->
      <div class="min-h-0 flex-1 overflow-hidden">
        {#if appStore.activeTab}
          {#key appStore.activeTabId}
            {#if appStore.activeTab.type === 'request'}
              <RequestBuilder
                bind:this={activeBuilder}
                tabId={appStore.activeTab.id}
                requestId={appStore.activeTab.entityId}
              />
            {:else if appStore.activeTab.type === 'environment'}
              <EnvironmentEditor
                tabId={appStore.activeTab.id}
                environmentId={appStore.activeTab.entityId}
                isActive={envTabActive}
              />
            {:else if appStore.activeTab.type === 'mcp'}
              <McpInspector
                tabId={appStore.activeTab.id}
                serverId={appStore.activeTab.entityId}
              />
            {:else if appStore.activeTab.type === 'websocket'}
              <WsInspector
                tabId={appStore.activeTab.id}
                connectionId={appStore.activeTab.entityId}
              />
            {:else if appStore.activeTab.type === 'collection'}
              <ContainerEditor
                tabId={appStore.activeTab.id}
                entityId={appStore.activeTab.entityId}
                entityType="collection"
              />
            {:else if appStore.activeTab.type === 'folder'}
              <ContainerEditor
                tabId={appStore.activeTab.id}
                entityId={appStore.activeTab.entityId}
                entityType="folder"
              />
            {/if}
          {/key}
        {:else}
          <!-- Empty state -->
          <div class="flex h-full items-center justify-center">
            <div class="text-center">
              <svg class="mx-auto mb-4 h-16 w-16 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="0.5">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 class="text-lg font-semibold text-surface-400">Vaxtly</h2>
              <p class="mt-1 text-sm text-surface-500">Create or open a request to get started</p>
              <div class="mt-4 flex items-center justify-center gap-4 text-xs text-surface-600">
                <span><kbd class="rounded bg-surface-800 px-1.5 py-0.5 text-surface-400">Cmd+N</kbd> New request</span>
                <span><kbd class="rounded bg-surface-800 px-1.5 py-0.5 text-surface-400">Cmd+B</kbd> Toggle sidebar</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- System log panel -->
      <SystemLog />
    </div>
  </div>

  <SettingsModal open={appStore.showSettings} onclose={() => appStore.closeSettings()} />
  <WelcomeGuide
    open={showWelcome}
    onclose={() => {
      showWelcome = false
      // Chain into WhatsNew for brand-new users so they always see the
      // headline-feature pitch even if they skipped through the carousel.
      // For existing-user manual re-opens via Help → Welcome, this re-evaluates
      // fresh state and no-ops if last_seen_version already matches.
      maybeShowWhatsNew()
    }}
  />
  <WhatsNewModal
    open={showWhatsNew}
    onclose={() => {
      showWhatsNew = false
      // Single source of truth for "user has seen this release's pitch".
      settingsStore.set('app.last_seen_version', settingsStore.get('app.version'))
    }}
  />
  <ToastContainer />

  {#if activeConflict}
    <ConflictModal
      conflict={activeConflict}
      onresolve={handleConflictResolve}
      onclose={dismissConflict}
    />
  {/if}

  {#if activeOrphan && !activeConflict}
    <OrphanedCollectionModal
      name={activeOrphan.collectionName}
      onresolve={handleOrphanResolve}
      onclose={dismissOrphan}
    />
  {/if}

  {#if activeMcpOrphan && !activeConflict && !activeOrphan}
    <OrphanedCollectionModal
      name={activeMcpOrphan.serverName}
      onresolve={handleMcpOrphanResolve}
      onclose={dismissMcpOrphan}
    />
  {/if}

  {#if curlDetected}
    <CurlImportModal
      parsed={curlDetected.parsed}
      rawCurl={curlDetected.raw}
      onimport={handleCurlImport}
      onclose={dismissCurlDetection}
    />
  {/if}
</div>

<style>
  /* --- Sidebar resize divider --- */
  .sidebar-divider {
    flex-shrink: 0;
    width: 1px;
    background: var(--border-subtle);
    cursor: col-resize;
    position: relative;
    transition: background 0.15s, width 0.15s;
  }
  .sidebar-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 3px;
    height: 24px;
    border-radius: 9999px;
    background: transparent;
    transition: background 0.15s;
  }
  .sidebar-divider::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
  }
  .sidebar-divider:hover,
  .sidebar-divider--dragging {
    width: 3px;
    background: var(--tint-subtle);
  }
  .sidebar-divider:hover::before,
  .sidebar-divider--dragging::before {
    background: color-mix(in srgb, var(--color-brand-500) 40%, transparent);
  }

  .update-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-bottom: 1px solid var(--glass-border);
    font-size: calc(12px + var(--ui-bump));
    color: var(--color-surface-200);
    flex-shrink: 0;
  }
  .update-text {
    flex: 1;
    min-width: 0;
  }
  .update-code {
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--color-surface-700);
    font-family: monospace;
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-brand-300);
  }
  .update-btn {
    padding: 3px 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--tint-muted);
    color: var(--color-surface-200);
    font-size: calc(11px + var(--ui-bump));
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s;
  }
  .update-btn:hover {
    background: var(--tint-strong);
  }
  .update-btn-primary {
    border-color: var(--color-brand-500);
    background: color-mix(in srgb, var(--color-brand-500) 25%, var(--color-surface-700));
    color: var(--color-brand-200);
  }
  .update-btn-primary:hover {
    background: color-mix(in srgb, var(--color-brand-500) 40%, var(--color-surface-700));
  }
  .update-progress-track {
    width: 100px;
    height: 4px;
    border-radius: 2px;
    background: var(--color-surface-700);
    overflow: hidden;
    flex-shrink: 0;
  }
  .update-progress-bar {
    height: 100%;
    border-radius: 2px;
    background: var(--color-brand-400);
    transition: width 0.3s ease;
  }
  .update-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--color-surface-400);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.12s, background 0.12s;
  }
  .update-dismiss:hover {
    color: var(--color-surface-200);
    background: var(--tint-muted);
  }
  .update-dismiss svg {
    width: 14px;
    height: 14px;
  }
</style>
