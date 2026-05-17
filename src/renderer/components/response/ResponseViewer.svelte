<script lang="ts">
  import type { ResponseData, SSEEvent, GqlSubscriptionEvent, GqlSubscriptionStatus } from '../../lib/types'
  import HtmlPreview from './HtmlPreview.svelte'
  import ResponseBody from './ResponseBody.svelte'
  import ResponseHeaders from './ResponseHeaders.svelte'
  import ResponseCookies from './ResponseCookies.svelte'
  import SSEEventsTab from './SSEEventsTab.svelte'
  import AssertionResultsTab from './AssertionResultsTab.svelte'
  import GqlSubscriptionEventsTab from './GqlSubscriptionEventsTab.svelte'

  import { formatSize, formatTime } from '../../lib/utils/formatters'

  interface Props {
    response: ResponseData | null
    loading: boolean
    streaming?: boolean
    sseEvents?: SSEEvent[]
    sseBody?: string
    sseMetrics?: {
      eventCount: number
      duration: number
      size: number
      startTime: number
    }
    gqlSubStatus?: GqlSubscriptionStatus
    gqlSubEvents?: GqlSubscriptionEvent[]
  }

  let { response, loading, streaming = false, sseEvents, sseBody, sseMetrics, gqlSubStatus, gqlSubEvents }: Props = $props()

  let activeTab = $state<'body' | 'headers' | 'cookies' | 'preview' | 'events' | 'tests' | 'subscription'>('body')

  let hasGqlSub = $derived(gqlSubStatus && gqlSubStatus !== 'disconnected')
  let gqlSubConnected = $derived(gqlSubStatus === 'connected')

  // Auto-switch to Events tab when SSE streaming starts
  $effect(() => {
    if (streaming && response?.isSSE) {
      activeTab = 'events'
    }
  })

  let headerCount = $derived(response ? Object.keys(response.headers).length : 0)
  let cookieCount = $derived(response?.cookies?.length ?? 0)
  let assertionResults = $derived(response?.assertionResults ?? [])
  let assertionPassCount = $derived(assertionResults.filter(r => r.passed).length)
  let assertionFailCount = $derived(assertionResults.filter(r => !r.passed).length)

  let isHtml = $derived.by(() => {
    if (!response) return false
    const ct = response.headers['content-type'] ?? response.headers['Content-Type'] ?? ''
    return ct.includes('text/html')
  })

  // Status classification for styling
  let isError = $derived(response?.status === 0)

  let statusClass = $derived.by(() => {
    if (!response) return ''
    const s = response.status
    if (s >= 200 && s < 300) return 'success'
    if (s >= 300 && s < 400) return 'redirect'
    if (s >= 400 && s < 500) return 'client-error'
    if (s >= 500) return 'server-error'
    return 'error'
  })

  /** Strip IPC wrapper from error messages for display */
  let errorMessage = $derived.by(() => {
    if (!response || !isError) return ''
    const msg = response.statusText || String(response.body) || 'Unknown error'
    return msg.replace(/^Error:\s*Error invoking remote method '[^']+?':\s*(Error:\s*)?/i, '')
  })
</script>

<div class="flex flex-col h-full">
  {#if hasGqlSub}
    <!-- GraphQL Subscription view -->
    <GqlSubscriptionEventsTab events={gqlSubEvents ?? []} connected={gqlSubConnected ?? false} />

  {:else if !response && !loading}
    <!-- Empty state -->
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-700/30 text-surface-600 mb-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p class="text-[13px] text-surface-400 mb-2">Send a request to see the response</p>
        <p class="rv-empty-hint flex items-center justify-center gap-1 text-[11px] text-surface-500">
          <kbd>Cmd</kbd> + <kbd>Enter</kbd>
        </p>
      </div>
    </div>

  {:else if loading && !streaming}
    <!-- Loading state -->
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <div class="flex items-center justify-center gap-1.5 mb-3">
          <span class="rv-loader-dot"></span>
          <span class="rv-loader-dot"></span>
          <span class="rv-loader-dot"></span>
        </div>
        <p class="text-[13px] text-surface-400 mb-2">Sending request...</p>
      </div>
    </div>

  {:else if response}
    <!-- Status bar -->
    <div class="rv-status--{statusClass} flex items-center justify-between shrink-0 px-3 py-1.5 gap-3" style="border-bottom: 1px solid var(--glass-border); background: var(--tint-faint)">
      <div class="flex items-center gap-2 min-w-0">
        <span class="rv-status-led w-2 h-2 rounded-full shrink-0"></span>
        <span
          class="rv-status-code font-mono text-xs font-bold tracking-wide"
          style="font-feature-settings: var(--font-feature-mono)"
        >
          {response.status === 0 ? 'ERR' : response.status}
        </span>
        {#if !isError}
          <span class="text-xs text-surface-300 whitespace-nowrap overflow-hidden text-ellipsis">{response.statusText}</span>
        {/if}
      </div>
      {#if streaming && sseMetrics}
        <div class="flex items-center gap-2 shrink-0">
          <span class="flex items-center gap-1.5">
            <span class="sse-pulse w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="text-[9px] uppercase tracking-widest font-semibold text-emerald-400">STREAMING</span>
          </span>
          <span class="w-px h-2.5 bg-surface-700"></span>
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">Events</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{sseMetrics.eventCount}</span>
          </span>
          <span class="w-px h-2.5 bg-surface-700"></span>
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">Duration</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{formatTime(sseMetrics.duration)}</span>
          </span>
          <span class="w-px h-2.5 bg-surface-700"></span>
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">Size</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{formatSize(sseMetrics.size)}</span>
          </span>
        </div>
      {:else if !isError}
        <div class="flex items-center gap-2 shrink-0">
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">TTFB</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{formatTime(response.timing.ttfb)}</span>
          </span>
          <span class="w-px h-2.5 bg-surface-700"></span>
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">Total</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{formatTime(response.timing.total)}</span>
          </span>
          <span class="w-px h-2.5 bg-surface-700"></span>
          <span class="flex items-baseline gap-1">
            <span class="text-[9px] uppercase tracking-widest text-surface-500">Size</span>
            <span class="font-mono text-[11px] text-surface-300" style="font-feature-settings: var(--font-feature-mono)">{formatSize(response.size)}</span>
          </span>
        </div>
      {/if}
    </div>

    {#if isError}
      <!-- Error display -->
      <div class="flex flex-1 items-center justify-center p-8">
        <div class="rv-error-card max-w-lg text-center px-8 py-7 rounded-2xl">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style="background: color-mix(in srgb, var(--color-danger-light) 8%, transparent)">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="color-mix(in srgb, var(--color-danger-light) 10%, transparent)" stroke="var(--color-danger-light)" stroke-width="1.2" />
              <path d="M12 8v5" stroke="var(--color-danger-light)" stroke-width="1.8" stroke-linecap="round" />
              <circle cx="12" cy="16" r="0.8" fill="var(--color-danger-light)" />
            </svg>
          </div>
          <p class="text-[15px] text-surface-200 leading-relaxed font-medium mb-2">Request failed</p>
          <p class="text-[13px] text-surface-400 leading-relaxed">{errorMessage}</p>
        </div>
      </div>
    {:else}
      <!-- Response tabs -->
      <div class="flex items-stretch shrink-0 h-9 px-1 gap-px" style="border-bottom: 1px solid var(--glass-border)">
        <button
          class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
          class:rv-tab--active={activeTab === 'body'}
          onclick={() => activeTab = 'body'}
        >
          Body
        </button>
        <button
          class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
          class:rv-tab--active={activeTab === 'headers'}
          onclick={() => activeTab = 'headers'}
        >
          Headers
          <span class="rv-tab-badge text-[10px] leading-none py-0.5 px-[5px] rounded-full bg-surface-600/60 text-surface-300 font-medium">{headerCount}</span>
        </button>
        {#if cookieCount > 0}
          <button
            class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
            class:rv-tab--active={activeTab === 'cookies'}
            onclick={() => activeTab = 'cookies'}
          >
            Cookies
            <span class="rv-tab-badge text-[10px] leading-none py-0.5 px-[5px] rounded-full bg-surface-600/60 text-surface-300 font-medium">{cookieCount}</span>
          </button>
        {/if}
        {#if isHtml}
          <button
            class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
            class:rv-tab--active={activeTab === 'preview'}
            onclick={() => activeTab = 'preview'}
          >
            Preview
          </button>
        {/if}
        {#if response?.isSSE}
          <button
            class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
            class:rv-tab--active={activeTab === 'events'}
            onclick={() => activeTab = 'events'}
          >
            Events
            {#if sseEvents?.length}
              <span class="rv-tab-badge text-[10px] leading-none py-0.5 px-[5px] rounded-full bg-surface-600/60 text-surface-300 font-medium">{sseEvents.length}</span>
            {/if}
          </button>
        {/if}
        {#if assertionResults.length > 0}
          <button
            class="rv-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-surface-400 text-xs font-medium cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
            class:rv-tab--active={activeTab === 'tests'}
            onclick={() => activeTab = 'tests'}
          >
            Tests
            {#if assertionFailCount > 0}
              <span class="rv-tab-badge text-[10px] leading-none py-0.5 px-[5px] rounded-full bg-red-500/15 text-red-400 font-medium">{assertionFailCount} fail</span>
            {:else}
              <span class="rv-tab-badge text-[10px] leading-none py-0.5 px-[5px] rounded-full bg-emerald-500/15 text-emerald-400 font-medium">{assertionPassCount} pass</span>
            {/if}
          </button>
        {/if}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden">
        {#if activeTab === 'body'}
          <ResponseBody body={response.body} headers={response.headers} streamingBody={streaming ? sseBody : undefined} />
        {:else if activeTab === 'headers'}
          <ResponseHeaders headers={response.headers} />
        {:else if activeTab === 'cookies'}
          <ResponseCookies cookies={response.cookies ?? []} />
        {:else if activeTab === 'preview'}
          <HtmlPreview body={response.body} />
        {:else if activeTab === 'events'}
          <SSEEventsTab events={sseEvents} {streaming} />
        {:else if activeTab === 'tests'}
          <AssertionResultsTab results={assertionResults} />
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  /* --- kbd styling (nested selector, can't do in Tailwind) --- */
  .rv-empty-hint kbd {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-surface-700) 60%, transparent);
    border: 1px solid var(--color-surface-600);
    font-size: calc(10px + var(--ui-bump));
    font-family: inherit;
    color: var(--color-surface-300);
    line-height: 1.4;
  }

  /* --- Loader dots animation --- */
  .rv-loader-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-brand-400);
    animation: rv-bounce 1.2s ease-in-out infinite;
  }

  .rv-loader-dot:nth-child(2) { animation-delay: 0.15s; }
  .rv-loader-dot:nth-child(3) { animation-delay: 0.3s; }

  @keyframes rv-bounce {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1.1); }
  }

  /* --- Error card --- */
  .rv-error-card {
    background: color-mix(in srgb, var(--color-danger-light) 3%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger-light) 8%, transparent);
  }

  /* --- Status LED glow cascade --- */
  .rv-status--success .rv-status-led { background: var(--color-status-success); box-shadow: 0 0 8px color-mix(in srgb, var(--color-status-success) 40%, transparent), 0 0 2px color-mix(in srgb, var(--color-status-success) 60%, transparent); }
  .rv-status--redirect .rv-status-led { background: var(--color-status-redirect); box-shadow: 0 0 8px color-mix(in srgb, var(--color-status-redirect) 35%, transparent), 0 0 2px color-mix(in srgb, var(--color-status-redirect) 50%, transparent); }
  .rv-status--client-error .rv-status-led { background: var(--color-status-client-error); box-shadow: 0 0 8px color-mix(in srgb, var(--color-status-client-error) 40%, transparent), 0 0 2px color-mix(in srgb, var(--color-status-client-error) 60%, transparent); }
  .rv-status--server-error .rv-status-led { background: var(--color-danger-light); box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger-light) 40%, transparent), 0 0 2px color-mix(in srgb, var(--color-danger-light) 60%, transparent); }
  .rv-status--error .rv-status-led { background: var(--color-danger-light); box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger-light) 40%, transparent), 0 0 2px color-mix(in srgb, var(--color-danger-light) 60%, transparent); }

  /* --- Status code color cascade --- */
  .rv-status--success .rv-status-code { color: var(--color-status-success); }
  .rv-status--redirect .rv-status-code { color: var(--color-status-redirect); }
  .rv-status--client-error .rv-status-code { color: var(--color-status-client-error); }
  .rv-status--server-error .rv-status-code { color: var(--color-danger-light); }
  .rv-status--error .rv-status-code { color: var(--color-danger-light); }

  /* --- SSE streaming pulse --- */
  .sse-pulse {
    animation: sse-pulse 1.5s ease-in-out infinite;
  }

  @keyframes sse-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* --- Active tab indicator (glass pill) --- */
  .rv-tab--active {
    color: var(--color-brand-400);
    background: var(--tint-active);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
  }

  .rv-tab--active:hover {
    color: var(--color-brand-400);
    background: var(--tint-active);
  }

  /* --- Active tab badge color change --- */
  .rv-tab--active .rv-tab-badge {
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-400);
  }
</style>
