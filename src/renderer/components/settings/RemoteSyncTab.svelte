<script lang="ts">
  import Toggle from '../shared/Toggle.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import { mcpStore } from '../../lib/stores/mcp.svelte'
  import { appStore } from '../../lib/stores/app.svelte'
  import SensitiveDataModal from '../modals/SensitiveDataModal.svelte'

  let provider = $state<'github' | 'gitlab'>('github')
  let baseUrl = $state('')
  let repository = $state('')
  let token = $state('')
  let branch = $state('main')
  let autoSync = $state(false)

  let testing = $state(false)
  let pulling = $state(false)
  let pushing = $state(false)
  let saving = $state(false)
  let status = $state<{ type: 'success' | 'error'; message: string } | null>(null)
  let sensitiveFindings = $state<{ source: string; requestName: string | null; requestId: string | null; field: string; key: string; maskedValue: string }[]>([])
  let showSensitiveModal = $state(false)

  const wsId = $derived(appStore.activeWorkspaceId)

  $effect(() => {
    // Re-load config when active workspace changes
    const _ws = appStore.activeWorkspaceId
    loadConfig()
  })

  let hasWorkspaceConfig = $state(false)

  async function getSetting(key: string): Promise<string | undefined> {
    if (wsId) {
      const val = await window.api.workspaceSettings.get(wsId, key)
      if (val !== undefined) return val
      // Fall back to global only if workspace has no sync config at all
      if (!hasWorkspaceConfig) return window.api.settings.get(key)
      return undefined
    }
    return window.api.settings.get(key)
  }

  async function setSetting(key: string, value: string): Promise<void> {
    if (wsId) {
      await window.api.workspaceSettings.set(wsId, key, value)
    } else {
      await window.api.settings.set(key, value)
    }
  }

  async function loadConfig(): Promise<void> {
    // Check if workspace has its own sync config
    if (wsId) {
      const all = await window.api.workspaceSettings.getAll(wsId)
      hasWorkspaceConfig = !!all.sync && Object.keys(all.sync).length > 0
    } else {
      hasWorkspaceConfig = false
    }

    const [p, bu, r, t, b, a] = await Promise.all([
      getSetting('sync.provider'),
      getSetting('sync.base_url'),
      getSetting('sync.repository'),
      getSetting('sync.token'),
      getSetting('sync.branch'),
      getSetting('sync.auto_sync'),
    ])
    if (p === 'github' || p === 'gitlab') provider = p
    else provider = 'github'
    baseUrl = bu ?? ''
    repository = r ?? ''
    token = t ?? ''
    branch = b ?? 'main'
    autoSync = a === 'true' || a === '1'
  }

  async function saveConfig(): Promise<void> {
    saving = true
    status = null
    try {
      await Promise.all([
        setSetting('sync.provider', provider),
        setSetting('sync.base_url', baseUrl),
        setSetting('sync.repository', repository),
        setSetting('sync.token', token),
        setSetting('sync.branch', branch),
        setSetting('sync.auto_sync', String(autoSync)),
      ])
      if (wsId) hasWorkspaceConfig = true
      status = { type: 'success', message: 'Sync configuration saved' }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Failed to save' }
    } finally {
      saving = false
    }
  }

  async function testConnection(): Promise<void> {
    testing = true
    status = null
    try {
      await saveConfig()
      const ok = await window.api.sync.testConnection(wsId ?? undefined)
      status = ok
        ? { type: 'success', message: 'Connection successful' }
        : { type: 'error', message: 'Connection failed — check your credentials and repository' }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Connection failed' }
    } finally {
      testing = false
    }
  }

  async function pullNow(): Promise<void> {
    pulling = true
    status = null
    try {
      const result = await window.api.sync.pull(appStore.activeWorkspaceId ?? undefined)
      if (result.success) {
        status = { type: 'success', message: result.message || `Pulled ${result.pulled ?? 0} collections` }
        await collectionsStore.loadAll(appStore.activeWorkspaceId ?? undefined)
        await mcpStore.loadServers(appStore.activeWorkspaceId!)
      } else {
        status = { type: 'error', message: result.message || 'Pull failed' }
      }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Pull failed' }
    } finally {
      pulling = false
    }
  }

  async function pushAll(): Promise<void> {
    pushing = true
    status = null
    try {
      // Scan all sync-enabled collections and MCP servers for sensitive data
      const syncCollections = collectionsStore.collections.filter((c) => c.sync_enabled)
      const allFindings: typeof sensitiveFindings = []
      for (const col of syncCollections) {
        const findings = await window.api.sync.scanSensitive(col.id)
        allFindings.push(...findings)
      }
      const syncServers = mcpStore.servers.filter((s) => s.sync_enabled === 1)
      for (const server of syncServers) {
        const findings = await window.api.sync.scanMcpSensitive(server.id)
        allFindings.push(...findings)
      }

      if (allFindings.length > 0) {
        sensitiveFindings = allFindings
        showSensitiveModal = true
        pushing = false
        return
      }

      await doPushAll(false)
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Push failed' }
      pushing = false
    }
  }

  async function doPushAll(sanitize: boolean): Promise<void> {
    pushing = true
    status = null
    try {
      // Push each sync-enabled collection individually so we can pass sanitize
      const syncCollections = collectionsStore.collections.filter(
        (c) => c.sync_enabled && (c.is_dirty || !c.remote_sha),
      )
      let pushed = 0
      const errors: string[] = []

      for (const col of syncCollections) {
        try {
          const result = await window.api.sync.pushCollection(col.id, sanitize, wsId ?? undefined)
          if (result.success) pushed += (result.pushed ?? 0)
          else if (result.message) errors.push(result.message)
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      if (errors.length > 0) {
        status = { type: 'error', message: errors.join('; ') }
      } else if (pushed > 0) {
        status = { type: 'success', message: `Pushed ${pushed} collection(s)` }
      } else {
        status = { type: 'success', message: 'Everything up to date' }
      }
      await collectionsStore.loadAll(wsId ?? undefined)
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Push failed' }
    } finally {
      pushing = false
    }
  }

  function handleSensitivePushAnyway(): void {
    showSensitiveModal = false
    doPushAll(false)
  }

  function handleSensitivePushSanitized(): void {
    showSensitiveModal = false
    doPushAll(true)
  }

  function toggleAutoSync(value: boolean): void {
    autoSync = value
  }

  function clearStatus(): void {
    status = null
  }
</script>

<div class="sync-tab">
  <!-- Status banner -->
  {#if status}
    <button class="status-banner" class:is-success={status.type === 'success'} class:is-error={status.type === 'error'} onclick={clearStatus}>
      <div class="status-icon">
        {#if status.type === 'success'}
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 5V8.5M8 11H8.005" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        {/if}
      </div>
      <span class="status-text">{status.message}</span>
      <svg class="status-dismiss" viewBox="0 0 12 12" fill="none">
        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </button>
  {/if}

  <!-- Inherited config hint -->
  {#if wsId && !hasWorkspaceConfig}
    <div class="inherited-banner">
      <svg viewBox="0 0 16 16" fill="none" class="inherited-icon">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1"/>
        <path d="M8 7V11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="8" cy="5.2" r="0.7" fill="currentColor"/>
      </svg>
      <span>Showing global defaults. Save to set config for this workspace.</span>
    </div>
  {/if}

  <!-- Connection section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon connection-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m4 -2v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="section-title">Connection</div>
        <div class="section-subtitle">Git repository for remote sync{#if appStore.activeWorkspace} — {appStore.activeWorkspace.name}{/if}</div>
      </div>
    </div>

    <!-- Provider -->
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Provider</span>
      </div>
      <div class="provider-picker">
        <button
          class="provider-option"
          class:is-active={provider === 'github'}
          onclick={() => { provider = 'github' }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" class="provider-logo">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </button>
        <button
          class="provider-option"
          class:is-active={provider === 'gitlab'}
          onclick={() => { provider = 'gitlab' }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" class="provider-logo">
            <path d="M8 14.5L10.74 5.61H5.26L8 14.5Z"/>
            <path d="M8 14.5L5.26 5.61H1.03L8 14.5Z" opacity="0.7"/>
            <path d="M1.03 5.61L0.07 8.56C-0.02 8.84 0.08 9.14 0.32 9.32L8 14.5L1.03 5.61Z" opacity="0.5"/>
            <path d="M1.03 5.61H5.26L3.43 0.1C3.34-0.15 2.93-0.15 2.83 0.1L1.03 5.61Z"/>
            <path d="M8 14.5L10.74 5.61H14.97L8 14.5Z" opacity="0.7"/>
            <path d="M14.97 5.61L15.93 8.56C16.02 8.84 15.92 9.14 15.68 9.32L8 14.5L14.97 5.61Z" opacity="0.5"/>
            <path d="M14.97 5.61H10.74L12.57 0.1C12.66-0.15 13.07-0.15 13.17 0.1L14.97 5.61Z"/>
          </svg>
          GitLab
        </button>
      </div>
    </div>

    <!-- Instance URL -->
    <div class="field-group">
      <span class="field-label">Instance URL</span>
      <input
        type="text"
        value={baseUrl}
        oninput={(e) => { baseUrl = (e.target as HTMLInputElement).value }}
        placeholder={provider === 'github' ? 'https://github.company.com' : 'https://gitlab.company.com'}
        class="text-input"
      />
      <span class="field-hint">Leave empty for {provider === 'github' ? 'github.com' : 'gitlab.com'}. For self-hosted, enter the root URL (no /api path).</span>
    </div>

    <!-- Repository -->
    <div class="field-group">
      <span class="field-label">Repository</span>
      <input
        type="text"
        value={repository}
        oninput={(e) => { repository = (e.target as HTMLInputElement).value }}
        placeholder="owner/repository"
        class="text-input"
      />
      <span class="field-hint">Format: owner/repo (e.g., acme/api-collections)</span>
    </div>

    <!-- Token -->
    <div class="field-group">
      <span class="field-label">Access Token</span>
      <input
        type="password"
        value={token}
        oninput={(e) => { token = (e.target as HTMLInputElement).value }}
        placeholder={provider === 'github' ? 'ghp_...' : 'glpat-...'}
        class="text-input"
      />
      <span class="field-hint">Personal access token with repo read/write permissions</span>
    </div>

    <!-- Branch -->
    <div class="field-group">
      <span class="field-label">Branch</span>
      <input
        type="text"
        value={branch}
        oninput={(e) => { branch = (e.target as HTMLInputElement).value }}
        placeholder="main"
        class="text-input"
      />
    </div>

    <!-- Auto Sync -->
    <div class="setting-row last">
      <div class="setting-info">
        <span class="setting-label">Auto Sync</span>
        <span class="setting-desc">Pull on startup, push on save</span>
      </div>
      <Toggle checked={autoSync} onchange={toggleAutoSync} />
    </div>
  </section>

  <!-- Actions -->
  <div class="actions">
    <button class="action-btn primary" onclick={saveConfig} disabled={saving}>
      {#if saving}<span class="spinner"></span>{/if}
      {saving ? 'Saving...' : 'Save'}
    </button>
    <button class="action-btn secondary" onclick={testConnection} disabled={testing}>
      {#if testing}<span class="spinner"></span>{/if}
      {testing ? 'Testing...' : 'Test Connection'}
    </button>
    <div class="action-spacer"></div>
    <button class="action-btn secondary" onclick={pullNow} disabled={pulling}>
      {#if pulling}<span class="spinner"></span>{/if}
      <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
        <path d="M7 2V12M7 12L3.5 8.5M7 12L10.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {pulling ? 'Pulling...' : 'Pull'}
    </button>
    <button class="action-btn secondary" onclick={pushAll} disabled={pushing}>
      {#if pushing}<span class="spinner"></span>{/if}
      <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
        <path d="M7 12V2M7 2L3.5 5.5M7 2L10.5 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {pushing ? 'Pushing...' : 'Push All'}
    </button>
  </div>

  <!-- Help card -->
  <div class="help-card">
    <div class="help-title">
      <svg viewBox="0 0 14 14" fill="none" class="help-icon">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1"/>
        <path d="M7 6.5V9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <circle cx="7" cy="4.8" r="0.6" fill="currentColor"/>
      </svg>
      How sync works
    </div>
    <ul class="help-list">
      <li>Collections are serialized to YAML and stored in your Git repository</li>
      <li>Enable sync per collection from its context menu in the sidebar</li>
      <li>Conflicts are detected automatically and resolved via a prompt</li>
      <li>Sensitive data (tokens, passwords) is flagged before pushing</li>
    </ul>
  </div>
</div>

{#if showSensitiveModal}
  <SensitiveDataModal
    findings={sensitiveFindings}
    onclose={() => { showSensitiveModal = false }}
    onsyncanyway={handleSensitivePushAnyway}
    onsyncwithout={handleSensitivePushSanitized}
  />
{/if}

<style>
  .sync-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Status banner */
  .status-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid;
    font-size: calc(12px + var(--ui-bump));
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
    transition: opacity 0.15s;
    animation: slideIn 0.2s ease-out;
  }
  .status-banner:hover { opacity: 0.85; }
  .status-banner.is-success {
    border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    color: var(--color-banner-success);
  }
  .status-banner.is-error {
    border-color: color-mix(in srgb, var(--color-danger-light) 25%, transparent);
    background: color-mix(in srgb, var(--color-danger-light) 8%, transparent);
    color: var(--color-banner-error);
  }
  .status-icon { flex-shrink: 0; width: 16px; height: 16px; }
  .status-icon svg { width: 16px; height: 16px; }
  .status-text { flex: 1; min-width: 0; }
  .status-dismiss { flex-shrink: 0; width: 12px; height: 12px; opacity: 0.4; }
  .status-banner:hover .status-dismiss { opacity: 0.8; }

  /* Inherited config banner */
  .inherited-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--color-info) 20%, transparent);
    background: color-mix(in srgb, var(--color-info) 6%, transparent);
    color: var(--color-info-muted);
    font-size: calc(11px + var(--ui-bump));
    line-height: 1.4;
    animation: slideIn 0.2s ease-out;
  }
  .inherited-icon {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    opacity: 0.8;
  }

  /* Sections */
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .section-icon svg { width: 16px; height: 16px; }
  .connection-icon {
    background: color-mix(in srgb, var(--color-success-muted) 12%, transparent);
    color: var(--color-success-muted);
  }
  .section-title {
    font-size: calc(13px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
    line-height: 1.2;
  }
  .section-subtitle {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.3;
  }

  /* Setting rows */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-default);
  }
  .setting-row.last { border-bottom: none; }
  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .setting-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
  }
  .setting-desc {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
  }

  /* Provider picker */
  .provider-picker {
    display: flex;
    gap: 4px;
  }
  .provider-option {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-surface-400);
    font-size: calc(11px + var(--ui-bump));
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .provider-option:hover {
    border-color: var(--glass-border);
    background: var(--tint-subtle);
    color: var(--color-surface-300);
  }
  .provider-option.is-active {
    border-color: color-mix(in srgb, var(--color-brand-500) 50%, transparent);
    background: color-mix(in srgb, var(--color-brand-500) 8%, transparent);
    color: var(--color-brand-300);
  }
  .provider-logo {
    width: 14px;
    height: 14px;
  }

  /* Field groups */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
  }
  .text-input {
    height: 32px;
    width: 100%;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--tint-muted);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    outline: none;
    transition: border-color 0.12s;
  }
  .text-input::placeholder {
    color: var(--color-surface-500);
  }
  .text-input:focus {
    border-color: var(--color-brand-500);
  }
  .field-hint {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.3;
  }

  /* Actions */
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .action-spacer {
    flex: 1;
    min-width: 8px;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
    border: none;
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .action-btn.primary {
    background: var(--color-brand-600);
    color: white;
  }
  .action-btn.primary:not(:disabled):hover {
    background: var(--color-brand-500);
  }
  .action-btn.secondary {
    background: transparent;
    border: 1px solid var(--glass-border);
    color: var(--color-surface-300);
  }
  .action-btn.secondary:not(:disabled):hover {
    background: var(--tint-active);
    border-color: var(--border-default);
    color: var(--color-surface-200);
  }
  .btn-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Help card */
  .help-card {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--glass-border);
    background: var(--tint-subtle);
  }
  .help-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: calc(11px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-400);
    margin-bottom: 6px;
  }
  .help-icon {
    width: 13px;
    height: 13px;
    opacity: 0.6;
  }
  .help-list {
    list-style: disc;
    list-style-position: inside;
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.6;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
