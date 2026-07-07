<script lang="ts">
  import { HTTP_METHODS } from '../../../shared/constants'
  import { getMethodColor } from '../../lib/utils/http-colors'
  import VarInput from '../shared/VarInput.svelte'

  interface Props {
    method: string
    url: string
    loading: boolean
    unsaved: boolean
    subscriptionMode?: boolean
    subscribed?: boolean
    onmethodchange: (method: string) => void
    onurlchange: (url: string) => void
    onsend: () => void
    oncancel: () => void
    onsave: () => void
    onpaste?: (e: ClipboardEvent) => void
  }

  let { method, url, loading, unsaved, subscriptionMode = false, subscribed = false, onmethodchange, onurlchange, onsend, oncancel, onsave, onpaste }: Props = $props()

  let saveFeedback = $state('')
  let varInput: { focus: () => void } | undefined

  // Method dropdown state
  let methodOpen = $state(false)
  let methodFilter = $state('')
  let methodInputEl = $state<HTMLInputElement | null>(null)
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let dropdownEl = $state<HTMLDivElement | null>(null)
  let dropdownPos = $state({ top: 0, left: 0 })

  let filteredMethods = $derived(
    methodFilter
      ? HTTP_METHODS.filter((m) => m.startsWith(methodFilter.toUpperCase()))
      : [...HTTP_METHODS]
  )

  function openMethodDropdown(): void {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    dropdownPos = { top: rect.bottom + 4, left: rect.left }
    methodFilter = ''
    methodOpen = true
    requestAnimationFrame(() => {
      methodInputEl?.focus()
    })
  }

  function commitMethod(): void {
    const value = methodFilter.trim().toUpperCase()
    if (value) {
      onmethodchange(value)
    }
    methodOpen = false
    triggerEl?.focus()
  }

  function selectMethod(m: string): void {
    onmethodchange(m)
    methodOpen = false
    triggerEl?.focus()
  }

  function handleMethodInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitMethod()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      methodOpen = false
      triggerEl?.focus()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = [...(dropdownEl?.querySelectorAll('[role="option"]') ?? [])] as HTMLElement[]
      items[0]?.focus()
    }
  }

  function handleDropdownKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      methodOpen = false
      triggerEl?.focus()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = [...(dropdownEl?.querySelectorAll('[role="option"]') ?? [])] as HTMLElement[]
      const current = items.findIndex((el) => el === document.activeElement)
      if (e.key === 'ArrowUp' && current <= 0) {
        methodInputEl?.focus()
        return
      }
      const next = e.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length
      items[next]?.focus()
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const focused = document.activeElement as HTMLElement
      focused?.click()
    }
  }

  function handleTriggerKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMethodDropdown()
    }
  }

  function handleClickOutside(e: MouseEvent): void {
    if (!methodOpen) return
    if (triggerEl?.contains(e.target as Node)) return
    if (dropdownEl?.contains(e.target as Node)) return
    methodOpen = false
  }

  $effect(() => {
    if (methodOpen) {
      document.addEventListener('mousedown', handleClickOutside, true)
      return () => document.removeEventListener('mousedown', handleClickOutside, true)
    }
  })

  async function handleSave(): Promise<void> {
    await onsave()
    saveFeedback = 'Saved'
    setTimeout(() => saveFeedback = '', 1200)
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      onsend()
    }
  }

  export function focus(): void {
    varInput?.focus()
  }
</script>

<div class="flex items-center gap-2 px-3 py-2.5">
  <div class="url-bar-inner flex-1 min-w-0 flex items-center rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-150" style="background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: inset 0 1px 0 var(--glass-highlight); --method-color: {getMethodColor(method)}">
    <!-- Method selector -->
    <div class="relative flex items-center shrink-0" style="border-right: 1px solid var(--glass-border)">
      <button
        bind:this={triggerEl}
        onclick={openMethodDropdown}
        onkeydown={handleTriggerKeydown}
        class="method-trigger flex items-center justify-center gap-1 px-3 h-[38px] w-[90px] border-none cursor-pointer outline-none transition-[background] duration-150"
        style:color={getMethodColor(method)}
        aria-haspopup="listbox"
        aria-expanded={methodOpen}
      >
        <span class="font-mono text-xs font-bold tracking-[0.02em]" style="font-feature-settings: var(--font-feature-mono)">{method}</span>
        <svg class="shrink-0 opacity-50 transition-[transform,opacity] duration-150" class:rotate-180={methodOpen} width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      <span class="method-led {method}"></span>
    </div>

    <!-- URL input with variable highlight -->
    <VarInput
      bind:this={varInput}
      value={url}
      oninput={(value) => onurlchange(value)}
      onkeydown={handleKeydown}
      {onpaste}
      placeholder="Enter request URL..."
      class="url-input"
    />

    <!-- Send / Cancel / Subscribe / Unsubscribe -->
    {#if loading}
      <button onclick={oncancel} class="btn-cancel flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200 ease-in-out">
        <div class="cancel-ring shrink-0 w-4 h-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="56.5" stroke-linecap="round" class="ring-track"/>
          </svg>
        </div>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">Stop</span>
      </button>
    {:else if subscriptionMode && subscribed}
      <button onclick={oncancel} class="btn-cancel flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200 ease-in-out">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">Unsubscribe</span>
      </button>
    {:else}
      <button onclick={onsend} disabled={!url.trim()} class="btn-send flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200 ease-in-out disabled:opacity-25 disabled:cursor-not-allowed">
        <svg class="send-arrow shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">{subscriptionMode ? 'Subscribe' : 'Send'}</span>
      </button>
    {/if}
  </div>

  <!-- Save (outside the pill) -->
  <button
    onclick={handleSave}
    disabled={!unsaved && !saveFeedback}
    class="btn-save flex items-center justify-center w-[38px] h-[38px] rounded-2xl text-surface-500 cursor-default shrink-0 transition-[color,background,border-color,box-shadow] duration-200 disabled:opacity-50 disabled:cursor-default"
    style="background: var(--glass-bg); border: 1px solid var(--glass-border)"
    class:btn-save--active={unsaved}
    class:btn-save--saved={!!saveFeedback}
    title="Save (Cmd+S)"
  >
    {#if saveFeedback}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
    {/if}
  </button>
</div>

<!-- Method dropdown (fixed to escape overflow clipping) -->
{#if methodOpen}
  <div
    bind:this={dropdownEl}
    class="fixed z-100 min-w-[120px] p-1 rounded-xl animate-[dropdown-in_0.15s_ease-out]"
    style="top: {dropdownPos.top}px; left: {dropdownPos.left}px; background: var(--glass-bg-heavy); backdrop-filter: blur(var(--glass-blur-heavy)); -webkit-backdrop-filter: blur(var(--glass-blur-heavy)); border: 1px solid var(--glass-border); box-shadow: var(--shadow-dropdown)"
    role="listbox"
    tabindex="-1"
    aria-label="HTTP Method"
    onkeydown={handleDropdownKeydown}
  >
    <input
      bind:this={methodInputEl}
      bind:value={methodFilter}
      onkeydown={handleMethodInputKeydown}
      class="method-input w-full py-1.5 px-2.5 mb-1 border-none rounded-lg bg-transparent outline-none font-mono text-xs font-bold tracking-[0.02em] text-surface-100"
      style="font-feature-settings: var(--font-feature-mono); background: var(--tint-subtle)"
      placeholder="Type method..."
      spellcheck="false"
      autocomplete="off"
    />
    {#each filteredMethods as m (m)}
      <button
        role="option"
        aria-selected={m === method}
        data-selected={m === method ? '' : undefined}
        class="method-item flex items-center gap-2 w-full py-1.5 px-2.5 border-none rounded-lg bg-transparent cursor-pointer outline-none transition-[background] duration-100 hover:bg-[var(--tint-active)] focus-visible:bg-[var(--tint-active)]"
        class:method-item--active={m === method}
        onclick={() => selectMethod(m)}
        tabindex={-1}
      >
        <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--color-method-{m.toLowerCase()})"></span>
        <span class="font-mono text-xs font-bold tracking-[0.02em] flex-1 text-left" style:color={getMethodColor(m)} style="font-feature-settings: var(--font-feature-mono)">{m}</span>
        {#if m === method}
          <svg class="shrink-0 text-brand-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  /* --- Focus ring glow (method-colored) --- */
  .url-bar-inner:focus-within {
    border-color: color-mix(in srgb, var(--method-color) 40%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--method-color) 15%, transparent), inset 0 1px 0 var(--glass-highlight);
  }

  /* --- Method trigger (glass backgrounds) --- */
  .method-trigger {
    background: transparent;
  }

  .method-trigger:hover {
    background: var(--tint-subtle);
  }

  .method-trigger:hover svg {
    opacity: 0.8;
  }

  /* --- Method LED glow cascade --- */
  .method-led {
    position: absolute;
    right: 10px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    pointer-events: none;
    transition: background 0.2s, box-shadow 0.2s;
    display: none;
  }

  .method-led.GET { background: var(--color-method-get); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-get) 50%, transparent); }
  .method-led.POST { background: var(--color-method-post); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-post) 40%, transparent); }
  .method-led.PUT { background: var(--color-method-put); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-put) 40%, transparent); }
  .method-led.PATCH { background: var(--color-method-patch); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-patch) 40%, transparent); }
  .method-led.DELETE { background: var(--color-method-delete); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-delete) 50%, transparent); }
  .method-led.QUERY { background: var(--color-method-query); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-query) 40%, transparent); }
  .method-led.HEAD { background: var(--color-method-head); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-head) 40%, transparent); }
  .method-led.OPTIONS { background: var(--color-method-options); box-shadow: none; }
  .method-led.LIST { background: var(--color-method-list); box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-list) 40%, transparent); }

  /* --- Method input in dropdown --- */
  .method-input::placeholder {
    color: var(--color-surface-500);
    font-weight: 500;
  }

  /* --- Method dropdown active item --- */
  .method-item--active {
    background: var(--tint-muted);
  }

  /* --- URL input (targets VarInput internals) --- */
  :global(.url-input) {
    position: relative;
    width: 100%;
    height: 38px;
    line-height: 38px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: var(--color-surface-100);
    font-size: calc(13px + var(--ui-bump));
    font-family: var(--font-mono);
    font-feature-settings: var(--font-feature-mono);
    outline: none;
  }

  /* --- Save button state cascade (color-mix combinations) --- */
  .btn-save--active {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, var(--glass-bg));
    cursor: pointer;
  }

  .btn-save--active:hover {
    background: color-mix(in srgb, var(--color-success) 15%, var(--glass-bg));
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 12%, transparent);
  }

  .btn-save--saved {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
    background: color-mix(in srgb, var(--color-success) 12%, var(--glass-bg));
    cursor: default;
  }

  /* --- Send button (method-colored) --- */
  .btn-send {
    background: color-mix(in srgb, var(--method-color) 10%, transparent);
    color: var(--method-color);
    border-left: 1px solid var(--glass-border);
  }

  .btn-send:hover:not(:disabled) {
    background: color-mix(in srgb, var(--method-color) 20%, transparent);
    color: var(--method-color);
    filter: brightness(1.15);
  }

  .btn-send:active:not(:disabled) {
    background: color-mix(in srgb, var(--method-color) 28%, transparent);
  }

  .send-arrow {
    transition: transform 0.2s ease;
  }

  .btn-send:hover:not(:disabled) .send-arrow {
    transform: translateX(2px);
  }

  /* --- Cancel button (color-mix border & backgrounds) --- */
  .btn-cancel {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger-light);
    border-left: 1px solid var(--glass-border);
  }

  .btn-cancel:hover {
    background: color-mix(in srgb, var(--color-danger) 20%, transparent);
    color: var(--color-danger-lighter);
  }

  /* --- Cancel ring animation --- */
  .cancel-ring {
    animation: spin-360 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .ring-track {
    stroke-dashoffset: 14;
    animation: ring-chase 1.2s ease-in-out infinite;
  }

  @keyframes ring-chase {
    0% { stroke-dashoffset: 42; }
    50% { stroke-dashoffset: 10; }
    100% { stroke-dashoffset: 42; }
  }
</style>
