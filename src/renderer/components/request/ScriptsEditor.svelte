<script lang="ts">
  import { onMount } from 'svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import type { ScriptsConfig } from '../../lib/types'

  interface Props {
    scripts: ScriptsConfig
    collectionId?: string
    requestId: string
    onchange: (scripts: ScriptsConfig) => void
  }

  let { scripts, collectionId, requestId, onchange }: Props = $props()

  // Available requests in the same collection (exclude self)
  let availableRequests = $derived(
    collectionsStore.requests
      .filter((r) => r.collection_id === collectionId && r.id !== requestId)
      .map((r) => ({ id: r.id, name: r.name, method: r.method })),
  )

  let hasPreRequest = $derived(!!scripts.pre_request)
  let hasPostResponse = $derived(!!scripts.post_response && scripts.post_response.length > 0)

  // --- Searchable request picker state ---
  let pickerOpen = $state(false)
  let pickerSearch = $state('')
  let pickerButtonEl = $state<HTMLElement | null>(null)
  let pickerPanelEl = $state<HTMLElement | null>(null)
  let pickerSearchEl = $state<HTMLElement | null>(null)
  let pickerStyle = $state('')

  const selectedRequest = $derived(
    availableRequests.find((r) => r.id === scripts.pre_request?.request_id) ?? null
  )

  const filteredRequests = $derived.by(() => {
    if (!pickerSearch.trim()) return availableRequests
    const q = pickerSearch.trim().toLowerCase()
    return availableRequests.filter(
      (r) => r.name.toLowerCase().includes(q) || r.method.toLowerCase().includes(q)
    )
  })

  const methodColors: Record<string, string> = {
    GET: 'var(--color-method-get)',
    POST: 'var(--color-method-post)',
    PUT: 'var(--color-method-put)',
    PATCH: 'var(--color-method-patch)',
    DELETE: 'var(--color-method-delete)',
    HEAD: 'var(--color-method-head)',
    OPTIONS: 'var(--color-method-options)',
  }

  function togglePicker(): void {
    pickerOpen = !pickerOpen
    if (pickerOpen) {
      pickerSearch = ''
      if (pickerButtonEl) {
        const rect = pickerButtonEl.getBoundingClientRect()
        pickerStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px; width: ${rect.width}px;`
      }
    }
  }

  function selectRequest(id: string): void {
    updatePreRequestId(id)
    pickerOpen = false
  }

  $effect(() => {
    if (pickerOpen && pickerSearchEl) {
      pickerSearchEl.focus()
    }
  })

  onMount(() => {
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node
      if (
        pickerPanelEl && !pickerPanelEl.contains(target) &&
        pickerButtonEl && !pickerButtonEl.contains(target)
      ) {
        pickerOpen = false
      }
    }

    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') pickerOpen = false
    }

    document.addEventListener('click', handleClickOutside, true)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('click', handleClickOutside, true)
      document.removeEventListener('keydown', handleKey)
    }
  })

  // --- Pre-request actions ---

  function togglePreRequest(): void {
    if (hasPreRequest) {
      onchange({ ...scripts, pre_request: undefined })
    } else {
      onchange({ ...scripts, pre_request: { action: 'send_request', request_id: '' } })
    }
  }

  function updatePreRequestId(id: string): void {
    const existing = scripts.pre_request
    onchange({ ...scripts, pre_request: { action: 'send_request', request_id: id, skip_if_valid: existing?.skip_if_valid } })
  }

  function toggleSkipIfValid(): void {
    const pre = scripts.pre_request
    if (!pre) return
    if (pre.skip_if_valid) {
      onchange({ ...scripts, pre_request: { ...pre, skip_if_valid: undefined } })
    } else {
      onchange({ ...scripts, pre_request: { ...pre, skip_if_valid: { token_variable: '', expires_at_variable: '' } } })
    }
  }

  function updateSkipIfValid(field: 'token_variable' | 'expires_at_variable', value: string): void {
    const pre = scripts.pre_request
    if (!pre?.skip_if_valid) return
    onchange({ ...scripts, pre_request: { ...pre, skip_if_valid: { ...pre.skip_if_valid, [field]: value } } })
  }

  let hasSkipIfValid = $derived(!!scripts.pre_request?.skip_if_valid)

  // --- Post-response actions ---

  function addPostResponse(action: 'set_variable' | 'set_token_expiry' = 'set_variable'): void {
    const existing = scripts.post_response ?? []
    onchange({ ...scripts, post_response: [...existing, { action, source: '', target: '' }] })
  }

  function updatePostResponse(index: number, field: 'source' | 'target' | 'action', value: string): void {
    const updated = [...(scripts.post_response ?? [])]
    updated[index] = { ...updated[index], [field]: value }
    onchange({ ...scripts, post_response: updated })
  }

  function removePostResponse(index: number): void {
    const updated = (scripts.post_response ?? []).filter((_, i) => i !== index)
    onchange({ ...scripts, post_response: updated.length > 0 ? updated : undefined })
  }
</script>

<div class="p-3 flex flex-col gap-5">
  <!-- Pre-request script -->
  <section>
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-xs font-medium text-surface-300 m-0">Pre-request Script</h3>
      <button
        onclick={togglePreRequest}
        class="border-none bg-transparent text-xs font-sans cursor-pointer p-0 transition-colors duration-[0.12s] {hasPreRequest ? 'text-danger-light hover:text-danger-lighter' : 'text-brand-400 hover:text-brand-300'}"
      >
        {hasPreRequest ? 'Remove' : '+ Add'}
      </button>
    </div>

    {#if hasPreRequest}
      <div class="p-2.5 rounded-md border border-surface-700 bg-surface-800/50">
        <span class="block text-[11px] text-surface-400 mb-1.5">Send dependent request first</span>

        <!-- Searchable request picker -->
        <button
          bind:this={pickerButtonEl}
          onclick={togglePicker}
          class="se-picker-trigger"
          class:se-picker-trigger--open={pickerOpen}
        >
          {#if selectedRequest}
            <span class="font-mono text-[10px] font-bold tracking-[0.02em] shrink-0" style="color: {methodColors[selectedRequest.method] ?? '#94a3b8'}; font-feature-settings: var(--font-feature-mono)">
              {selectedRequest.method}
            </span>
            <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{selectedRequest.name}</span>
          {:else}
            <span class="flex-1 text-surface-500">Select a request...</span>
          {/if}
          <svg class="shrink-0 text-surface-500 transition-transform duration-150 ease-in-out {pickerOpen ? 'rotate-180' : ''}" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        {#if pickerOpen}
          <div bind:this={pickerPanelEl} class="se-picker-panel" style={pickerStyle}>
            <!-- Search -->
            <div class="flex items-center gap-1.5 px-2.5 py-2 border-b border-surface-700">
              <svg class="shrink-0 text-surface-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                bind:this={pickerSearchEl}
                type="text"
                placeholder={"Filter requests\u2026"}
                bind:value={pickerSearch}
                class="w-full bg-transparent border-none outline-none text-surface-200 text-xs font-sans placeholder:text-surface-500"
              />
            </div>

            <!-- List -->
            <div class="max-h-[200px] overflow-y-auto py-1">
              {#each filteredRequests as req (req.id)}
                {@const isSelected = scripts.pre_request?.request_id === req.id}
                <button
                  onclick={() => selectRequest(req.id)}
                  class="flex items-center gap-2 w-full py-1.5 px-2.5 border-none bg-transparent text-xs font-sans cursor-pointer text-left transition-[background,color] duration-100 hover:bg-surface-600/50 hover:text-surface-100 {isSelected ? 'text-surface-100' : 'text-surface-300'}"
                >
                  <span class="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    {#if isSelected}
                      <span class="se-picker-item-dot"></span>
                    {/if}
                  </span>
                  <span class="font-mono text-[10px] font-bold tracking-[0.02em] shrink-0 w-12" style="color: {methodColors[req.method] ?? '#94a3b8'}; font-feature-settings: var(--font-feature-mono)">
                    {req.method}
                  </span>
                  <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{req.name}</span>
                </button>
              {:else}
                <div class="py-3 px-2.5 text-center text-[11px] text-surface-500">
                  {pickerSearch.trim() ? 'No matches' : 'No requests available'}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if availableRequests.length === 0}
          <p class="text-[11px] text-surface-500 mt-1 mb-0">No other requests in this collection.</p>
        {/if}

        <!-- Skip if valid (smart token caching) -->
        <div class="mt-2 pt-2" style="border-top: 1px solid var(--color-surface-700)">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasSkipIfValid}
              onchange={toggleSkipIfValid}
              class="accent-[var(--color-brand-500)]"
            />
            <span class="text-[11px] text-surface-300">Only fetch when needed</span>
          </label>

          {#if hasSkipIfValid}
            <div class="mt-1.5 flex flex-col gap-1.5 pl-5">
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-surface-500">Token variable (skip if set)</span>
                <input
                  type="text"
                  value={scripts.pre_request?.skip_if_valid?.token_variable ?? ''}
                  oninput={(e) => updateSkipIfValid('token_variable', e.currentTarget.value)}
                  placeholder="api_token"
                  class="h-[26px] w-full px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                />
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-surface-500">Expiry variable (Unix ms timestamp)</span>
                <input
                  type="text"
                  value={scripts.pre_request?.skip_if_valid?.expires_at_variable ?? ''}
                  oninput={(e) => updateSkipIfValid('expires_at_variable', e.currentTarget.value)}
                  placeholder="api_token_expires_at"
                  class="h-[26px] w-full px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                />
              </div>
              <p class="text-[10px] text-surface-600 m-0">Skips the request if the token exists and hasn't expired (30s safety margin).</p>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <p class="text-[11px] text-surface-500 m-0 leading-relaxed">
        Fire a dependent request before this one runs. Useful for fetching auth tokens.
      </p>
    {/if}
  </section>

  <!-- Post-response scripts -->
  <section>
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-xs font-medium text-surface-300 m-0">Post-response Scripts</h3>
      <div class="flex gap-2">
        <button onclick={() => addPostResponse('set_variable')} class="border-none bg-transparent text-brand-400 text-xs font-sans cursor-pointer p-0 transition-colors duration-[0.12s] hover:text-brand-300">
          + Variable
        </button>
        <button onclick={() => addPostResponse('set_token_expiry')} class="border-none bg-transparent text-brand-400 text-xs font-sans cursor-pointer p-0 transition-colors duration-[0.12s] hover:text-brand-300">
          + Expiry
        </button>
      </div>
    </div>

    {#if hasPostResponse}
      <div class="flex flex-col gap-1.5">
        {#each scripts.post_response ?? [] as script, i (i)}
          <div class="p-2.5 rounded-md border border-surface-700 bg-surface-800/50 flex items-start gap-2">
            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
              <!-- Action type badge -->
              <span class="text-[9px] font-bold uppercase tracking-wider {script.action === 'set_token_expiry' ? 'text-warning' : 'text-surface-500'}">
                {script.action === 'set_token_expiry' ? 'Set Token Expiry' : 'Set Variable'}
              </span>
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-surface-500">{script.action === 'set_token_expiry' ? 'Source (e.g. body.expires_in — seconds)' : 'Source (e.g. body.data.token, header.X-Auth, status)'}</span>
                <input
                  type="text"
                  value={script.source}
                  oninput={(e) => updatePostResponse(i, 'source', e.currentTarget.value)}
                  placeholder={script.action === 'set_token_expiry' ? 'body.expires_in' : 'body.data.access_token'}
                  class="h-[30px] w-full px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                />
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-surface-500">{script.action === 'set_token_expiry' ? 'Target variable (stores absolute timestamp)' : 'Target variable name'}</span>
                <input
                  type="text"
                  value={script.target}
                  oninput={(e) => updatePostResponse(i, 'target', e.currentTarget.value)}
                  placeholder={script.action === 'set_token_expiry' ? 'api_token_expires_at' : 'auth_token'}
                  class="h-[30px] w-full px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                />
              </div>
            </div>
            <button
              onclick={() => removePostResponse(i)}
              class="flex items-center justify-center w-[26px] h-[26px] shrink-0 mt-2 border-none rounded-sm bg-transparent text-surface-500 cursor-pointer transition-[color,background] duration-100 hover:text-danger-light hover:bg-danger-light/[0.08]"
              title="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-[11px] text-surface-500 m-0 leading-relaxed">
        Extract values from the response and set them as collection variables.
      </p>
    {/if}
  </section>
</div>

<style>
  /* Picker trigger — open/focus state with box-shadow must stay scoped */
  .se-picker-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--color-surface-800);
    color: var(--color-surface-200);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    cursor: pointer;
    outline: none;
    text-align: left;
    transition: border-color 0.12s;
  }

  .se-picker-trigger:hover {
    border-color: var(--color-surface-600);
  }

  .se-picker-trigger--open {
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand-500) 15%, transparent);
  }

  /* Picker panel — fixed positioning + complex shadow */
  .se-picker-panel {
    position: fixed;
    z-index: 100;
    background: var(--color-surface-800);
    border: 1px solid var(--color-surface-600);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: slide-in 0.12s ease-out;
  }

  /* Dot glow effect */
  .se-picker-item-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-brand-400);
    box-shadow: 0 0 5px color-mix(in srgb, var(--color-brand-400) 50%, transparent);
  }
</style>
