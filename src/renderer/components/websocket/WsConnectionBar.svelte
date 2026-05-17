<script lang="ts">
  import VarInput from '../shared/VarInput.svelte'
  import type { WsConnectionStatus } from '../../lib/types'

  interface Props {
    url: string
    status: WsConnectionStatus
    unsaved: boolean
    onurlchange: (url: string) => void
    onconnect: () => void
    ondisconnect: () => void
    onsave: () => void
  }

  let { url, status, unsaved, onurlchange, onconnect, ondisconnect, onsave }: Props = $props()

  let saveFeedback = $state('')

  let isConnected = $derived(status === 'connected')
  let isConnecting = $derived(status === 'connecting')
  let protocolBadge = $derived(url.startsWith('wss://') || url.startsWith('wss:') ? 'WSS' : 'WS')

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isConnected) {
        ondisconnect()
      } else {
        onconnect()
      }
    }
  }

  async function handleSave(): Promise<void> {
    await onsave()
    saveFeedback = 'Saved'
    setTimeout(() => saveFeedback = '', 1200)
  }
</script>

<div class="flex items-center gap-2 px-3 py-2.5">
  <div class="url-bar-inner flex-1 min-w-0 flex items-center rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-150" style="background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: inset 0 1px 0 var(--glass-highlight)">
    <!-- Protocol badge -->
    <div class="flex items-center shrink-0 px-3 h-[38px]" style="border-right: 1px solid var(--glass-border)">
      <span class="font-mono text-xs font-bold tracking-[0.02em]" style="color: var(--color-method-ws); font-feature-settings: var(--font-feature-mono)">
        {protocolBadge}
      </span>
      <span class="ws-led"></span>
    </div>

    <!-- URL input -->
    <VarInput
      value={url}
      oninput={(value) => onurlchange(value)}
      onkeydown={handleKeydown}
      placeholder="ws://localhost:8080 or wss://..."
      class="url-input"
    />

    <!-- Connect / Disconnect -->
    {#if isConnecting}
      <button onclick={ondisconnect} class="btn-ws-cancel flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200">
        <div class="cancel-ring shrink-0 w-4 h-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="56.5" stroke-linecap="round" class="ring-track"/>
          </svg>
        </div>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">Cancel</span>
      </button>
    {:else if isConnected}
      <button onclick={ondisconnect} class="btn-ws-disconnect flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">Close</span>
      </button>
    {:else}
      <button onclick={onconnect} disabled={!url.trim()} class="btn-ws-connect flex items-center gap-[7px] pl-3.5 pr-4 h-[38px] border-none cursor-pointer whitespace-nowrap shrink-0 transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed">
        <svg class="connect-icon shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 5l7 7-7 7"/>
          <path d="M5 12h15"/>
        </svg>
        <span class="font-mono text-[11px] font-bold tracking-[0.06em] uppercase" style="font-feature-settings: var(--font-feature-mono)">Connect</span>
      </button>
    {/if}
  </div>

  <!-- Save -->
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

<style>
  .url-bar-inner:focus-within {
    border-color: color-mix(in srgb, var(--color-method-ws) 40%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-method-ws) 15%, transparent), inset 0 1px 0 var(--glass-highlight);
  }

  .ws-led {
    position: relative;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    margin-left: 6px;
    background: var(--color-method-ws);
    box-shadow: 0 0 6px color-mix(in srgb, var(--color-method-ws) 50%, transparent);
  }

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

  .btn-ws-connect {
    background: color-mix(in srgb, var(--color-method-ws) 10%, transparent);
    color: var(--color-method-ws);
    border-left: 1px solid var(--glass-border);
  }
  .btn-ws-connect:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-method-ws) 20%, transparent);
    filter: brightness(1.15);
  }

  .connect-icon {
    transition: transform 0.2s ease;
  }
  .btn-ws-connect:hover:not(:disabled) .connect-icon {
    transform: translateX(2px);
  }

  .btn-ws-disconnect {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger-light);
    border-left: 1px solid var(--glass-border);
  }
  .btn-ws-disconnect:hover {
    background: color-mix(in srgb, var(--color-danger) 20%, transparent);
  }

  .btn-ws-cancel {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger-light);
    border-left: 1px solid var(--glass-border);
  }
  .btn-ws-cancel:hover {
    background: color-mix(in srgb, var(--color-danger) 20%, transparent);
  }

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

  .btn-save--active {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, var(--glass-bg));
    cursor: pointer;
  }
  .btn-save--active:hover {
    background: color-mix(in srgb, var(--color-success) 15%, var(--glass-bg));
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  }
  .btn-save--saved {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
    background: color-mix(in srgb, var(--color-success) 12%, var(--glass-bg));
  }
</style>
