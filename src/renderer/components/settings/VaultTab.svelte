<script lang="ts">
  import { appStore } from '../../lib/stores/app.svelte'
  import { environmentsStore } from '../../lib/stores/environments.svelte'
  import Toggle from '../shared/Toggle.svelte'

  let provider = $state<'hashicorp' | 'aws'>('hashicorp')

  // HashiCorp fields
  let url = $state('')
  let authMethod = $state<'token' | 'approle'>('token')
  let token = $state('')
  let roleId = $state('')
  let secretId = $state('')
  let namespace = $state('')
  let enginePath = $state('secret')
  let verifySsl = $state(true)

  // AWS fields
  let awsEndpoint = $state('')
  let awsAuthMethod = $state<'keys' | 'profile' | 'default'>('keys')
  let awsRegion = $state('us-east-1')
  let awsProfile = $state('')
  let awsAccessKeyId = $state('')
  let awsSecretAccessKey = $state('')

  // Shared
  let autoSync = $state(false)

  let testing = $state(false)
  let pulling = $state(false)
  let saving = $state(false)
  let status = $state<{ type: 'success' | 'error'; message: string } | null>(null)

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
    if (wsId) {
      const all = await window.api.workspaceSettings.getAll(wsId)
      hasWorkspaceConfig = !!all.vault && Object.keys(all.vault).length > 0
    } else {
      hasWorkspaceConfig = false
    }

    const [p, u, am, t, ri, si, ns, ep, vs, as_, aam, ar, ap, aak, asak, aep] = await Promise.all([
      getSetting('vault.provider'),
      getSetting('vault.url'),
      getSetting('vault.auth_method'),
      getSetting('vault.token'),
      getSetting('vault.role_id'),
      getSetting('vault.secret_id'),
      getSetting('vault.namespace'),
      getSetting('vault.mount'),
      getSetting('vault.verify_ssl'),
      getSetting('vault.auto_sync'),
      getSetting('vault.aws_auth_method'),
      getSetting('vault.aws_region'),
      getSetting('vault.aws_profile'),
      getSetting('vault.aws_access_key_id'),
      getSetting('vault.aws_secret_access_key'),
      getSetting('vault.aws_endpoint'),
    ])
    provider = p === 'aws' ? 'aws' : 'hashicorp'
    url = u ?? ''
    if (am === 'token' || am === 'approle') authMethod = am
    else authMethod = 'token'
    token = t ?? ''
    roleId = ri ?? ''
    secretId = si ?? ''
    namespace = ns ?? ''
    enginePath = ep ?? 'secret'
    verifySsl = vs !== 'false' && vs !== '0'
    autoSync = as_ === 'true' || as_ === '1'
    if (aam === 'keys' || aam === 'profile' || aam === 'default') awsAuthMethod = aam
    else awsAuthMethod = 'keys'
    awsRegion = ar || 'us-east-1'
    awsProfile = ap ?? ''
    awsAccessKeyId = aak ?? ''
    awsSecretAccessKey = asak ?? ''
    awsEndpoint = aep ?? ''
  }

  async function saveConfig(): Promise<void> {
    saving = true
    status = null
    try {
      const promises: Promise<void>[] = [
        setSetting('vault.provider', provider),
        setSetting('vault.auto_sync', String(autoSync)),
      ]

      if (provider === 'hashicorp') {
        promises.push(
          setSetting('vault.url', url),
          setSetting('vault.auth_method', authMethod),
          setSetting('vault.token', token),
          setSetting('vault.role_id', roleId),
          setSetting('vault.secret_id', secretId),
          setSetting('vault.namespace', namespace),
          setSetting('vault.mount', enginePath),
          setSetting('vault.verify_ssl', String(verifySsl)),
        )
      } else {
        promises.push(
          setSetting('vault.aws_auth_method', awsAuthMethod),
          setSetting('vault.aws_region', awsRegion),
          setSetting('vault.aws_endpoint', awsEndpoint),
        )
        if (awsAuthMethod === 'keys') {
          promises.push(
            setSetting('vault.aws_access_key_id', awsAccessKeyId),
            setSetting('vault.aws_secret_access_key', awsSecretAccessKey),
          )
        } else if (awsAuthMethod === 'profile') {
          promises.push(setSetting('vault.aws_profile', awsProfile))
        }
      }

      await Promise.all(promises)
      if (wsId) hasWorkspaceConfig = true
      status = { type: 'success', message: 'Configuration saved' }
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
      const result = await window.api.vault.testConnection(wsId ?? undefined)
      status = result.success
        ? { type: 'success', message: result.message || 'Connection successful' }
        : { type: 'error', message: result.message || 'Connection failed' }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Connection failed' }
    } finally {
      testing = false
    }
  }

  async function pullFromVault(): Promise<void> {
    pulling = true
    status = null
    try {
      const result = await window.api.vault.pullAll(wsId ?? undefined)
      if (result.success) {
        await environmentsStore.loadAll(wsId ?? undefined)
        const parts: string[] = []
        if (result.created) parts.push(`${result.created} created`)
        if (result.refreshed) parts.push(`${result.refreshed} refreshed`)
        status = { type: 'success', message: parts.length > 0 ? `Pulled: ${parts.join(', ')}` : 'Everything up to date' }
      } else {
        status = { type: 'error', message: result.errors.join(', ') || 'Pull failed' }
      }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Pull failed' }
    } finally {
      pulling = false
    }
  }

  function toggleSsl(value: boolean): void {
    verifySsl = value
  }

  function toggleAutoSync(value: boolean): void {
    autoSync = value
  }

  function clearStatus(): void {
    status = null
  }
</script>

<div class="vault-tab">
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

  <!-- Provider picker -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Provider</span>
    </div>
    <div class="auth-picker">
      <button
        class="auth-option"
        class:is-active={provider === 'hashicorp'}
        onclick={() => { provider = 'hashicorp' }}
      >HashiCorp Vault</button>
      <button
        class="auth-option"
        class:is-active={provider === 'aws'}
        onclick={() => { provider = 'aws' }}
      >AWS Secrets Manager</button>
    </div>
  </div>

  <!-- Server section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon" class:vault-icon={provider === 'hashicorp'} class:aws-icon={provider === 'aws'}>
        {#if provider === 'hashicorp'}
          <svg viewBox="0 0 18 18" fill="none">
            <path d="M9 11V12.5M5 15H13C13.828 15 14.5 14.328 14.5 13.5V9C14.5 8.172 13.828 7.5 13 7.5H5C4.172 7.5 3.5 8.172 3.5 9V13.5C3.5 14.328 4.172 15 5 15Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 7.5V5.5C6 3.843 7.343 2.5 9 2.5C10.657 2.5 12 3.843 12 5.5V7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 18 18" fill="none">
            <path d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 8.5V16M2.5 5.5L9 8.5M9 8.5L15.5 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </div>
      <div>
        <div class="section-title">{provider === 'hashicorp' ? 'HashiCorp Vault' : 'AWS Secrets Manager'}</div>
        <div class="section-subtitle">Secrets management for environment variables{#if appStore.activeWorkspace} — {appStore.activeWorkspace.name}{/if}</div>
      </div>
    </div>

    {#if provider === 'hashicorp'}
      <!-- URL -->
      <div class="field-group">
        <span class="field-label">Vault URL</span>
        <input
          type="text"
          value={url}
          oninput={(e) => { url = (e.target as HTMLInputElement).value }}
          placeholder="https://vault.example.com"
          class="text-input"
        />
      </div>

      <!-- Auth Method -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Authentication</span>
        </div>
        <div class="auth-picker">
          <button
            class="auth-option"
            class:is-active={authMethod === 'token'}
            onclick={() => { authMethod = 'token' }}
          >Token</button>
          <button
            class="auth-option"
            class:is-active={authMethod === 'approle'}
            onclick={() => { authMethod = 'approle' }}
          >AppRole</button>
        </div>
      </div>

      <!-- Conditional auth fields -->
      {#if authMethod === 'token'}
        <div class="field-group">
          <span class="field-label">Token</span>
          <input
            type="password"
            value={token}
            oninput={(e) => { token = (e.target as HTMLInputElement).value }}
            placeholder="hvs...."
            class="text-input"
          />
        </div>
      {:else}
        <div class="field-row">
          <div class="field-group">
            <span class="field-label">Role ID</span>
            <input
              type="text"
              value={roleId}
              oninput={(e) => { roleId = (e.target as HTMLInputElement).value }}
              class="text-input"
            />
          </div>
          <div class="field-group">
            <span class="field-label">Secret ID</span>
            <input
              type="password"
              value={secretId}
              oninput={(e) => { secretId = (e.target as HTMLInputElement).value }}
              class="text-input"
            />
          </div>
        </div>
      {/if}

      <!-- Namespace + Engine Path side by side -->
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Namespace</span>
          <input
            type="text"
            value={namespace}
            oninput={(e) => { namespace = (e.target as HTMLInputElement).value }}
            placeholder="Optional — AppRole auth only"
            class="text-input"
          />
          <span class="field-hint">Only used during AppRole login. Leave empty for token auth.</span>
        </div>
        <div class="field-group">
          <span class="field-label">Engine Path</span>
          <input
            type="text"
            value={enginePath}
            oninput={(e) => { enginePath = (e.target as HTMLInputElement).value }}
            placeholder="org/ns/kv-engine"
            class="text-input"
          />
          <span class="field-hint">Full path to the KV engine, including namespaces if applicable.</span>
        </div>
      </div>

      <!-- Verify SSL (HashiCorp only) -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Verify SSL</span>
          <span class="setting-desc">Validate server certificate</span>
        </div>
        <Toggle checked={verifySsl} onchange={toggleSsl} />
      </div>
    {:else}
      <!-- AWS: Endpoint Override -->
      <div class="field-group">
        <span class="field-label">Endpoint Override</span>
        <input
          type="text"
          value={awsEndpoint}
          oninput={(e) => { awsEndpoint = (e.target as HTMLInputElement).value }}
          placeholder="Optional — e.g. http://localhost:4566"
          class="text-input"
        />
        <span class="field-hint">Custom endpoint URL for LocalStack or other AWS-compatible services. Leave empty for real AWS.</span>
      </div>

      <!-- AWS: Region -->
      <div class="field-group">
        <span class="field-label">Region</span>
        <input
          type="text"
          value={awsRegion}
          oninput={(e) => { awsRegion = (e.target as HTMLInputElement).value }}
          placeholder="us-east-1"
          class="text-input"
        />
      </div>

      <!-- AWS: Auth Method -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Authentication</span>
        </div>
        <div class="auth-picker">
          <button
            class="auth-option"
            class:is-active={awsAuthMethod === 'keys'}
            onclick={() => { awsAuthMethod = 'keys' }}
          >Access Keys</button>
          <button
            class="auth-option"
            class:is-active={awsAuthMethod === 'profile'}
            onclick={() => { awsAuthMethod = 'profile' }}
          >Profile</button>
          <button
            class="auth-option"
            class:is-active={awsAuthMethod === 'default'}
            onclick={() => { awsAuthMethod = 'default' }}
          >Default Chain</button>
        </div>
      </div>

      <!-- Conditional auth fields -->
      {#if awsAuthMethod === 'keys'}
        <div class="field-row">
          <div class="field-group">
            <span class="field-label">Access Key ID</span>
            <input
              type="password"
              value={awsAccessKeyId}
              oninput={(e) => { awsAccessKeyId = (e.target as HTMLInputElement).value }}
              placeholder="AKIA..."
              class="text-input"
            />
          </div>
          <div class="field-group">
            <span class="field-label">Secret Access Key</span>
            <input
              type="password"
              value={awsSecretAccessKey}
              oninput={(e) => { awsSecretAccessKey = (e.target as HTMLInputElement).value }}
              placeholder="wJalrXUtnFEMI..."
              class="text-input"
            />
          </div>
        </div>
      {:else if awsAuthMethod === 'profile'}
        <div class="field-group">
          <span class="field-label">Profile</span>
          <input
            type="text"
            value={awsProfile}
            oninput={(e) => { awsProfile = (e.target as HTMLInputElement).value }}
            placeholder="default"
            class="text-input"
          />
          <span class="field-hint">Named profile from ~/.aws/credentials (e.g. "default", "production").</span>
        </div>
      {:else}
        <div class="field-hint" style="padding: 4px 0;">
          Uses environment variables (<code>AWS_ACCESS_KEY_ID</code>, <code>AWS_SECRET_ACCESS_KEY</code>),
          the default profile in <code>~/.aws/credentials</code>, or EC2/ECS instance roles.
        </div>
      {/if}
    {/if}

    <div class="setting-row last">
      <div class="setting-info">
        <span class="setting-label">Auto Sync</span>
        <span class="setting-desc">Sync secrets on startup</span>
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
    <button class="action-btn secondary" onclick={pullFromVault} disabled={pulling}>
      {#if pulling}<span class="spinner"></span>{/if}
      <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
        <path d="M7 2V12M7 12L3.5 8.5M7 12L10.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {pulling ? 'Pulling...' : 'Pull All'}
    </button>
  </div>
</div>

<style>
  .vault-tab {
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
  .vault-icon {
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    color: var(--color-warning-light);
  }
  .aws-icon {
    background: color-mix(in srgb, var(--color-brand-500) 12%, transparent);
    color: var(--color-brand-300);
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

  /* Auth method picker */
  .auth-picker {
    display: flex;
    gap: 0;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
  }
  .auth-option {
    padding: 5px 12px;
    font-size: calc(11px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-400);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .auth-option:first-child {
    border-right: 1px solid var(--border-default);
  }
  .auth-option:hover {
    color: var(--color-surface-300);
    background: var(--tint-active);
  }
  .auth-option.is-active {
    background: color-mix(in srgb, var(--color-brand-500) 12%, transparent);
    color: var(--color-brand-300);
  }

  /* Field groups */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .field-row {
    display: flex;
    gap: 10px;
  }
  .field-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
  }
  .field-hint {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.3;
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

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
