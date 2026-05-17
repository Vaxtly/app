<script lang="ts">
  import { AUTH_TYPES } from '../../../shared/constants'
  import VarInput from '../shared/VarInput.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import type { AuthConfig } from '../../lib/types'

  interface Props {
    auth: AuthConfig
    requestId?: string
    isDraft?: boolean
    showInherit?: boolean
    onchange: (auth: AuthConfig) => void
  }

  let { auth, requestId, isDraft = false, showInherit = true, onchange }: Props = $props()

  let visibleTypes = $derived(showInherit ? AUTH_TYPES : AUTH_TYPES.filter(t => t !== 'inherit'))

  const typeLabels: Record<string, string> = {
    inherit: 'Inherit',
    none: 'No Auth',
    bearer: 'Bearer Token',
    basic: 'Basic Auth',
    'api-key': 'API Key',
    oauth2: 'OAuth 2.0',
  }

  let inheritedAuth = $derived.by((): AuthConfig | null => {
    if (auth.type !== 'inherit' || !requestId) return null
    return collectionsStore.resolveInheritedAuth(requestId)
  })

  function inheritedAuthLabel(resolved: AuthConfig | null): string {
    if (!resolved) return 'No authentication configured on parent collection or folder.'
    return `Inheriting ${typeLabels[resolved.type] ?? resolved.type} from parent.`
  }

  const grantTypeLabels: Record<string, string> = {
    authorization_code: 'Authorization Code',
    client_credentials: 'Client Credentials',
    password: 'Password',
  }

  let tokenLoading = $state(false)
  let tokenError = $state<string | null>(null)

  function updateField(field: keyof AuthConfig, value: string | boolean): void {
    onchange({ ...auth, [field]: value })
  }

  function formatExpiry(expiresAt: number | undefined): string {
    if (!expiresAt) return 'Unknown'
    const date = new Date(expiresAt)
    const now = Date.now()
    if (now >= expiresAt) return 'Expired'
    const diff = expiresAt - now
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Expires in <1 min'
    if (mins < 60) return `Expires in ${mins} min`
    const hrs = Math.floor(mins / 60)
    return `Expires in ${hrs}h ${mins % 60}m`
  }

  async function handleGetToken(): Promise<void> {
    if (!requestId) return
    tokenLoading = true
    tokenError = null
    try {
      const updated = await window.api.oauth2.getToken(requestId)
      onchange(updated)
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e)
    } finally {
      tokenLoading = false
    }
  }

  async function handleRefreshToken(): Promise<void> {
    if (!requestId) return
    tokenLoading = true
    tokenError = null
    try {
      const updated = await window.api.oauth2.refreshToken(requestId)
      onchange(updated)
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e)
    } finally {
      tokenLoading = false
    }
  }

  async function handleClearToken(): Promise<void> {
    tokenError = null
    try {
      const updated = await window.api.oauth2.clearToken(requestId)
      onchange(updated)
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<div class="ae-root">
  <!-- Type selector -->
  <div class="ae-types">
    {#each visibleTypes as type}
      <button
        onclick={() => onchange({ ...auth, type })}
        class="ae-type"
        class:ae-type--active={auth.type === type}
      >
        {typeLabels[type]}
      </button>
    {/each}
  </div>

  <!-- Auth fields -->
  <div class="ae-content">
    {#if auth.type === 'inherit'}
      <div class="ae-inherit-info">
        <p class="ae-hint">{inheritedAuthLabel(inheritedAuth)}</p>
        {#if inheritedAuth}
          <div class="ae-inherit-preview">
            <span class="ae-inherit-badge">{typeLabels[inheritedAuth.type] ?? inheritedAuth.type}</span>
            {#if inheritedAuth.type === 'bearer' && inheritedAuth.bearer_token}
              <code class="ae-inherit-detail">{inheritedAuth.bearer_token.slice(0, 30)}...</code>
            {:else if inheritedAuth.type === 'basic' && inheritedAuth.basic_username}
              <code class="ae-inherit-detail">{inheritedAuth.basic_username}</code>
            {:else if inheritedAuth.type === 'api-key' && inheritedAuth.api_key_header}
              <code class="ae-inherit-detail">{inheritedAuth.api_key_header}: {(inheritedAuth.api_key_value ?? '').slice(0, 20)}...</code>
            {:else if inheritedAuth.type === 'oauth2'}
              <code class="ae-inherit-detail">{inheritedAuth.oauth2_grant_type ?? 'authorization_code'}</code>
            {/if}
          </div>
        {/if}
      </div>
    {:else if auth.type === 'none'}
      <p class="ae-hint">This request does not use authentication.</p>
    {:else if auth.type === 'bearer'}
      <div class="ae-fields">
        <div class="ae-field">
          <span class="ae-label">Token</span>
          <VarInput
            id="auth-bearer-token"
            value={auth.bearer_token ?? ''}
            oninput={(value) => updateField('bearer_token', value)}
            placeholder="Enter bearer token..."
            class="ae-input"
          />
        </div>
      </div>
    {:else if auth.type === 'basic'}
      <div class="ae-fields">
        <div class="ae-field">
          <span class="ae-label">Username</span>
          <VarInput
            id="auth-basic-username"
            value={auth.basic_username ?? ''}
            oninput={(value) => updateField('basic_username', value)}
            placeholder="Username"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <label for="auth-basic-password" class="ae-label">Password</label>
          <VarInput
            id="auth-basic-password"
            type="password"
            value={auth.basic_password ?? ''}
            oninput={(value) => updateField('basic_password', value)}
            placeholder="Password"
            class="ae-input"
          />
        </div>
      </div>
    {:else if auth.type === 'api-key'}
      <div class="ae-fields">
        <div class="ae-field">
          <span class="ae-label">Header Name</span>
          <VarInput
            id="auth-apikey-header"
            value={auth.api_key_header ?? ''}
            oninput={(value) => updateField('api_key_header', value)}
            placeholder="X-API-Key"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <span class="ae-label">Value</span>
          <VarInput
            id="auth-apikey-value"
            value={auth.api_key_value ?? ''}
            oninput={(value) => updateField('api_key_value', value)}
            placeholder="API key value"
            class="ae-input"
          />
        </div>
      </div>
    {:else if auth.type === 'oauth2'}
      <div class="ae-fields">
        <!-- Grant type selector -->
        <div class="ae-field">
          <span class="ae-label">Grant Type</span>
          <select
            class="ae-select"
            value={auth.oauth2_grant_type ?? 'authorization_code'}
            onchange={(e) => updateField('oauth2_grant_type', e.currentTarget.value)}
          >
            {#each Object.entries(grantTypeLabels) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>

        <!-- Common fields -->
        <div class="ae-field">
          <span class="ae-label">Token URL</span>
          <VarInput
            id="auth-oauth2-token-url"
            value={auth.oauth2_access_token_url ?? ''}
            oninput={(value) => updateField('oauth2_access_token_url', value)}
            placeholder="https://auth.example.com/oauth/token"
            class="ae-input"
          />
        </div>

        {#if (auth.oauth2_grant_type ?? 'authorization_code') === 'authorization_code'}
          <div class="ae-field">
            <span class="ae-label">Authorization URL</span>
            <VarInput
              id="auth-oauth2-auth-url"
              value={auth.oauth2_authorization_url ?? ''}
              oninput={(value) => updateField('oauth2_authorization_url', value)}
              placeholder="https://auth.example.com/oauth/authorize"
              class="ae-input"
            />
          </div>
        {/if}

        <div class="ae-field">
          <span class="ae-label">Client ID</span>
          <VarInput
            id="auth-oauth2-client-id"
            value={auth.oauth2_client_id ?? ''}
            oninput={(value) => updateField('oauth2_client_id', value)}
            placeholder="Client ID"
            class="ae-input"
          />
        </div>

        <div class="ae-field">
          <span class="ae-label">Client Secret</span>
          <VarInput
            id="auth-oauth2-client-secret"
            type="password"
            value={auth.oauth2_client_secret ?? ''}
            oninput={(value) => updateField('oauth2_client_secret', value)}
            placeholder="Client secret (optional)"
            class="ae-input"
          />
        </div>

        <div class="ae-field">
          <span class="ae-label">Scope</span>
          <VarInput
            id="auth-oauth2-scope"
            value={auth.oauth2_scope ?? ''}
            oninput={(value) => updateField('oauth2_scope', value)}
            placeholder="openid profile email"
            class="ae-input"
          />
        </div>

        <div class="ae-field">
          <span class="ae-label">Audience</span>
          <VarInput
            id="auth-oauth2-audience"
            value={auth.oauth2_audience ?? ''}
            oninput={(value) => updateField('oauth2_audience', value)}
            placeholder="Optional"
            class="ae-input"
          />
        </div>

        {#if (auth.oauth2_grant_type ?? 'authorization_code') === 'authorization_code'}
          <div class="ae-row">
            <label class="ae-toggle">
              <input
                type="checkbox"
                checked={auth.oauth2_pkce !== false}
                onchange={(e) => updateField('oauth2_pkce', e.currentTarget.checked)}
              />
              <span class="ae-toggle-label">PKCE</span>
            </label>
          </div>
        {/if}

        {#if (auth.oauth2_grant_type ?? 'authorization_code') === 'password'}
          <div class="ae-field">
            <span class="ae-label">Username</span>
            <VarInput
              id="auth-oauth2-username"
              value={auth.oauth2_username ?? ''}
              oninput={(value) => updateField('oauth2_username', value)}
              placeholder="Username"
              class="ae-input"
            />
          </div>
          <div class="ae-field">
            <span class="ae-label">Password</span>
            <VarInput
              id="auth-oauth2-password"
              type="password"
              value={auth.oauth2_password ?? ''}
              oninput={(value) => updateField('oauth2_password', value)}
              placeholder="Password"
              class="ae-input"
            />
          </div>
        {/if}

        <!-- Token status -->
        <div class="ae-divider"></div>

        <div class="ae-token-section">
          <span class="ae-label">Token</span>

          {#if isDraft}
            <p class="ae-hint">Save the request first to use OAuth2 token operations.</p>
          {:else if auth.oauth2_access_token}
            <div class="ae-token-status">
              <div class="ae-token-info">
                <span class="ae-token-badge ae-token-badge--active">Active</span>
                <span class="ae-token-expiry">{formatExpiry(auth.oauth2_expires_at)}</span>
              </div>
              <code class="ae-token-preview">{auth.oauth2_access_token.slice(0, 40)}...</code>
            </div>
          {:else}
            <p class="ae-hint">No token. Click "Get Token" to authenticate.</p>
          {/if}

          {#if tokenError}
            <div class="ae-token-error">{tokenError}</div>
          {/if}

          <div class="ae-token-actions">
            <button
              class="ae-btn ae-btn--primary"
              onclick={handleGetToken}
              disabled={tokenLoading || isDraft}
            >
              {#if tokenLoading}
                <span class="ae-spinner"></span>
              {/if}
              Get Token
            </button>
            {#if auth.oauth2_refresh_token}
              <button
                class="ae-btn ae-btn--secondary"
                onclick={handleRefreshToken}
                disabled={tokenLoading || isDraft}
              >
                Refresh
              </button>
            {/if}
            {#if auth.oauth2_access_token}
              <button
                class="ae-btn ae-btn--danger"
                onclick={handleClearToken}
                disabled={tokenLoading || isDraft}
              >
                Clear
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .ae-root {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* --- Type selector --- */
  .ae-types {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-default);
  }

  .ae-type {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-400);
    font-size: calc(11px + var(--ui-bump));
    font-family: inherit;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
  }

  .ae-type:hover {
    color: var(--color-surface-200);
    background: color-mix(in srgb, var(--color-surface-700) 40%, transparent);
  }

  .ae-type--active {
    color: var(--color-brand-400);
    background: color-mix(in srgb, var(--color-brand-500) 12%, transparent);
    font-weight: 500;
  }

  .ae-type--active:hover {
    color: var(--color-brand-400);
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
  }

  /* --- Content --- */
  .ae-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }

  .ae-hint {
    font-size: calc(12px + var(--ui-bump));
    color: var(--color-surface-500);
    margin: 0;
  }

  .ae-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ae-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ae-label {
    font-size: calc(10px + var(--ui-bump));
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-surface-500);
  }

  :global(.ae-input) {
    height: 32px;
    line-height: 32px;
    width: 100%;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--color-surface-800);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s, background 0.12s;
  }

  :global(.ae-input:hover) {
    border-color: var(--color-surface-600);
  }

  :global(.ae-input:focus) {
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand-500) 15%, transparent);
  }

  /* --- OAuth2-specific --- */
  .ae-select {
    height: 32px;
    width: 100%;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--color-surface-800);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    cursor: pointer;
    transition: border-color 0.12s;
  }

  .ae-select:hover {
    border-color: var(--color-surface-600);
  }

  .ae-select:focus {
    border-color: var(--color-brand-500);
  }

  .ae-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ae-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: calc(12px + var(--ui-bump));
    color: var(--color-surface-300);
    cursor: pointer;
  }

  .ae-toggle input[type="checkbox"] {
    accent-color: var(--color-brand-500);
  }

  .ae-toggle-label {
    font-size: calc(11px + var(--ui-bump));
    font-weight: 500;
  }

  .ae-divider {
    height: 1px;
    background: var(--border-default);
    margin: 4px 0;
  }

  .ae-token-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ae-token-status {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ae-token-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ae-token-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: calc(10px + var(--ui-bump));
    font-weight: 500;
  }

  .ae-token-badge--active {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success);
  }

  .ae-token-expiry {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
  }

  .ae-token-preview {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-400);
    background: var(--color-surface-800);
    padding: 4px 6px;
    border-radius: 4px;
    word-break: break-all;
  }

  .ae-token-error {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-danger-light);
    padding: 6px 8px;
    background: color-mix(in srgb, var(--color-danger-light) 8%, transparent);
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--color-danger-light) 20%, transparent);
  }

  .ae-token-actions {
    display: flex;
    gap: 6px;
  }

  .ae-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: none;
    border-radius: 5px;
    font-size: calc(11px + var(--ui-bump));
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .ae-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ae-btn--primary {
    background: var(--color-brand-600);
    color: white;
  }

  .ae-btn--primary:not(:disabled):hover {
    background: var(--color-brand-500);
  }

  .ae-btn--secondary {
    background: var(--color-surface-700);
    color: var(--color-surface-200);
  }

  .ae-btn--secondary:not(:disabled):hover {
    background: var(--color-surface-600);
  }

  .ae-btn--danger {
    background: transparent;
    color: var(--color-danger-light);
    border: 1px solid color-mix(in srgb, var(--color-danger-light) 30%, transparent);
  }

  .ae-btn--danger:not(:disabled):hover {
    background: color-mix(in srgb, var(--color-danger-light) 10%, transparent);
  }

  .ae-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: ae-spin 0.6s linear infinite;
  }

  @keyframes ae-spin {
    to { transform: rotate(360deg); }
  }

  /* --- Inherit info --- */
  .ae-inherit-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ae-inherit-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-brand-500) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-brand-500) 15%, transparent);
  }

  .ae-inherit-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: calc(10px + var(--ui-bump));
    font-weight: 600;
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-400);
    white-space: nowrap;
  }

  .ae-inherit-detail {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-400);
    word-break: break-all;
  }

</style>
