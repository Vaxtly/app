<script lang="ts">
  import Modal from '../shared/Modal.svelte'
  import VarInput from '../shared/VarInput.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import type { AuthConfig } from '../../lib/types'

  interface Props {
    targetId: string
    targetType: 'collection' | 'folder'
    onclose: () => void
  }

  let { targetId, targetType, onclose }: Props = $props()

  const typeLabels: Record<string, string> = {
    none: 'No Auth',
    bearer: 'Bearer Token',
    basic: 'Basic Auth',
    'api-key': 'API Key',
    oauth2: 'OAuth 2.0',
  }

  // Available types for collection/folder (no 'inherit')
  const availableTypes = ['none', 'bearer', 'basic', 'api-key', 'oauth2'] as const

  let auth = $state<AuthConfig>({ type: 'none' })
  let saving = $state(false)

  // Load current auth from store
  $effect(() => {
    loadCurrent()
  })

  function loadCurrent(): void {
    let authJson: string | null = null
    if (targetType === 'collection') {
      const col = collectionsStore.getCollectionById(targetId)
      authJson = col?.auth ?? null
    } else {
      const folder = collectionsStore.getFolderById(targetId)
      authJson = folder?.auth ?? null
    }
    if (authJson) {
      try {
        auth = JSON.parse(authJson)
      } catch {
        auth = { type: 'none' }
      }
    } else {
      auth = { type: 'none' }
    }
  }

  function updateField(field: keyof AuthConfig, value: string | boolean): void {
    auth = { ...auth, [field]: value }
  }

  async function handleSave(): Promise<void> {
    saving = true
    try {
      const authJson = JSON.stringify(auth)
      if (targetType === 'collection') {
        await window.api.collections.update(targetId, { auth: authJson })
        await collectionsStore.reloadCollection(targetId)
      } else {
        const folder = collectionsStore.getFolderById(targetId)
        await window.api.folders.update(targetId, { auth: authJson })
        if (folder) await collectionsStore.reloadCollection(folder.collection_id)
      }
      onclose()
    } finally {
      saving = false
    }
  }
</script>

<Modal title="Set Authentication" {onclose} width="max-w-md">
  <!-- Type selector pills -->
  <div class="ae-types">
    {#each availableTypes as type (type)}
      <button
        onclick={() => { auth = { ...auth, type } }}
        class="ae-type"
        class:ae-type--active={auth.type === type}
      >
        {typeLabels[type]}
      </button>
    {/each}
  </div>

  <!-- Auth fields -->
  <div class="ae-content max-h-80 overflow-y-auto">
    {#if auth.type === 'none'}
      <p class="ae-hint">No authentication. Requests will only use auth if set directly on the request.</p>
    {:else if auth.type === 'bearer'}
      <div class="ae-fields">
        <div class="ae-field">
          <span class="ae-label">Token</span>
          <VarInput
            id="modal-auth-bearer-token"
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
            id="modal-auth-basic-username"
            value={auth.basic_username ?? ''}
            oninput={(value) => updateField('basic_username', value)}
            placeholder="Username"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <span class="ae-label">Password</span>
          <VarInput
            id="modal-auth-basic-password"
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
            id="modal-auth-apikey-header"
            value={auth.api_key_header ?? ''}
            oninput={(value) => updateField('api_key_header', value)}
            placeholder="X-API-Key"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <span class="ae-label">Value</span>
          <VarInput
            id="modal-auth-apikey-value"
            value={auth.api_key_value ?? ''}
            oninput={(value) => updateField('api_key_value', value)}
            placeholder="API key value"
            class="ae-input"
          />
        </div>
      </div>
    {:else if auth.type === 'oauth2'}
      <div class="ae-fields">
        <div class="ae-field">
          <span class="ae-label">Grant Type</span>
          <select
            class="ae-select"
            value={auth.oauth2_grant_type ?? 'authorization_code'}
            onchange={(e) => updateField('oauth2_grant_type', e.currentTarget.value)}
          >
            <option value="authorization_code">Authorization Code</option>
            <option value="client_credentials">Client Credentials</option>
            <option value="password">Password</option>
          </select>
        </div>
        <div class="ae-field">
          <span class="ae-label">Token URL</span>
          <VarInput
            id="modal-auth-oauth2-token-url"
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
              id="modal-auth-oauth2-auth-url"
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
            id="modal-auth-oauth2-client-id"
            value={auth.oauth2_client_id ?? ''}
            oninput={(value) => updateField('oauth2_client_id', value)}
            placeholder="Client ID"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <span class="ae-label">Client Secret</span>
          <VarInput
            id="modal-auth-oauth2-client-secret"
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
            id="modal-auth-oauth2-scope"
            value={auth.oauth2_scope ?? ''}
            oninput={(value) => updateField('oauth2_scope', value)}
            placeholder="openid profile email"
            class="ae-input"
          />
        </div>
        <div class="ae-field">
          <span class="ae-label">Audience</span>
          <VarInput
            id="modal-auth-oauth2-audience"
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
              id="modal-auth-oauth2-username"
              value={auth.oauth2_username ?? ''}
              oninput={(value) => updateField('oauth2_username', value)}
              placeholder="Username"
              class="ae-input"
            />
          </div>
          <div class="ae-field">
            <span class="ae-label">Password</span>
            <VarInput
              id="modal-auth-oauth2-password"
              type="password"
              value={auth.oauth2_password ?? ''}
              oninput={(value) => updateField('oauth2_password', value)}
              placeholder="Password"
              class="ae-input"
            />
          </div>
        {/if}
        <p class="ae-hint" style="margin-top: 4px">Token operations are available per-request when inheriting this auth.</p>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="mt-4 flex items-center justify-end gap-2 pt-4" style="border-top: 1px solid var(--glass-border)">
    <button onclick={onclose} class="rounded-lg px-3 py-1.5 text-xs text-surface-300 hover:bg-[var(--tint-active)]" style="border: 1px solid var(--glass-border)">
      Cancel
    </button>
    <button
      onclick={handleSave}
      disabled={saving}
      class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
    >
      {saving ? 'Saving...' : 'Save'}
    </button>
  </div>
</Modal>

<style>
  /* --- Type selector --- */
  .ae-types {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    padding: 6px 0;
    margin-bottom: 12px;
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
    padding: 0;
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
</style>
