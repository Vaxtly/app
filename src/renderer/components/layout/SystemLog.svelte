<script lang="ts">
  import { onMount } from 'svelte'
  import type { SessionLogEntry } from '../../lib/types'

  let logs = $state<SessionLogEntry[]>([])
  let expanded = $state(false)
  let panelHeight = $state(200)
  let expandedId = $state<string | null>(null)
  let detailTab = $state<'request' | 'response'>('request')

  onMount(async () => {
    // Load existing logs
    logs = await window.api.log.list()

    // Listen for new log entries pushed from main process
    const cleanup = window.api.on.logPush((entry) => {
      logs = [entry, ...logs].slice(0, 100)
    })

    return cleanup
  })

  async function clearLogs(): Promise<void> {
    await window.api.log.clear()
    logs = []
    expandedId = null
  }

  function toggleDetail(entry: SessionLogEntry): void {
    if (!entry.detail) return
    expandedId = expandedId === entry.id ? null : entry.id
    detailTab = 'request'
  }

  let dragging = $state(false)
  let dragStartY = 0
  let dragStartHeight = 0

  function onDragStart(e: PointerEvent): void {
    if (!expanded) return
    e.preventDefault()
    dragging = true
    dragStartY = e.clientY
    dragStartHeight = panelHeight
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }

  function onDragMove(e: PointerEvent): void {
    if (!dragging) return
    const delta = dragStartY - e.clientY
    panelHeight = Math.max(100, Math.min(600, dragStartHeight + delta))
  }

  function onDragEnd(): void {
    dragging = false
  }

  function formatTime(timestamp: string): string {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function getCategoryColor(category: SessionLogEntry['category']): string {
    switch (category) {
      case 'http': return 'var(--color-info)'
      case 'script': return 'var(--color-method-patch)'
      case 'sync': return 'var(--color-purple)'
      case 'vault': return 'var(--color-warning)'
      case 'system': return 'var(--color-surface-400)'
      default: return 'var(--color-surface-400)'
    }
  }

  function getCategoryLabel(category: SessionLogEntry['category']): string {
    return category === 'sync' ? 'git' : category
  }

  /** Parse and highlight git refs, URLs, and paths in log messages */
  function formatLogMessage(message: string): Array<{ text: string; type: 'text' | 'code' | 'url' }> {
    const segments: Array<{ text: string; type: 'text' | 'code' | 'url' }> = []
    // Match git refs (origin/main, HEAD, sha-like), paths (/foo/bar), and URLs
    const pattern = /(\b(?:origin\/[\w\-.]+|HEAD|main|master|[a-f0-9]{7,40})\b|https?:\/\/[^\s]+)/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(message)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: message.slice(lastIndex, match.index), type: 'text' })
      }
      const isUrl = match[0].startsWith('http')
      segments.push({ text: match[0], type: isUrl ? 'url' : 'code' })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < message.length) {
      segments.push({ text: message.slice(lastIndex), type: 'text' })
    }
    return segments.length > 0 ? segments : [{ text: message, type: 'text' }]
  }

  function formatDetailBody(body: string | undefined, headers: Record<string, string>): string {
    if (!body) return ''
    const ct = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
    if (ct.includes('json') || ct.includes('javascript')) {
      try { return JSON.stringify(JSON.parse(body), null, 2) } catch { /* not valid JSON */ }
    }
    return body
  }

  function formatDetailSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
</script>

<!-- Collapsible bottom panel -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex flex-col shrink-0"
  class:select-none={dragging}
  style="background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); height: {expanded ? panelHeight : 32}px"
>
  <!-- Drag handle -->
  {#if expanded}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sl-drag shrink-0 cursor-ns-resize"
      onpointerdown={onDragStart}
      onpointermove={onDragMove}
      onpointerup={onDragEnd}
      onpointercancel={onDragEnd}
    ></div>
  {/if}

  <!-- Header bar (always visible) -->
  <div class="flex items-center h-8 shrink-0 px-1" style={expanded ? undefined : `border-top: 1px solid var(--glass-border)`}>
    <button
      onclick={() => { expanded = !expanded }}
      class="flex items-center gap-1.5 px-2 h-full border-none bg-transparent font-mono text-[11px] font-medium cursor-pointer transition-colors duration-100 {expanded ? 'text-brand-400' : 'text-surface-400 hover:text-surface-200'}"
      style="font-feature-settings: var(--font-feature-mono)"
    >
      <svg
        class="sl-tab-chevron w-3 h-3"
        class:sl-tab-chevron--open={expanded}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
      >
        <path d="M5 15l7-7 7 7" />
      </svg>
      Logs
      {#if logs.length > 0}
        <span class="px-1.5 py-px rounded-full bg-surface-700 text-[10px] font-medium text-surface-300">{logs.length}</span>
      {/if}
    </button>

    <div class="flex-1"></div>

    {#if expanded}
      <button onclick={clearLogs} class="px-2 border-none bg-transparent text-[11px] text-surface-500 cursor-pointer transition-colors duration-100 hover:text-surface-300">Clear</button>
    {/if}
  </div>

  {#if expanded}
    <!-- Content -->
    <div class="sl-log-content flex-1 overflow-auto font-mono text-[11px]" style="font-feature-settings: var(--font-feature-mono)">
      {#if logs.length === 0}
        <div class="flex h-full items-center justify-center text-surface-600">No log entries</div>
      {:else}
        {#each logs as entry (entry.id)}
          <div
            role="button"
            tabindex="0"
            class="sl-log-row flex items-center gap-2 h-7 px-3 whitespace-nowrap transition-colors duration-100 hover:bg-[var(--tint-faint)] {entry.detail ? 'cursor-pointer' : ''}"
            style="border-bottom: 1px solid var(--border-muted)"
            onclick={() => toggleDetail(entry)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDetail(entry) } }}
          >
            {#if entry.detail}
              <svg
                class="sl-row-chevron shrink-0 w-3 h-3 text-surface-500"
                class:sl-row-chevron--open={expandedId === entry.id}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            {:else}
              <span class="shrink-0 w-3"></span>
            {/if}
            <span class="shrink-0 w-18 text-surface-600" style="font-variant-numeric: tabular-nums">{formatTime(entry.timestamp)}</span>
            <span class="sl-badge" style="--cat-color: {getCategoryColor(entry.category)}">{getCategoryLabel(entry.category)}</span>
            <span class="shrink-0 w-16 text-surface-500">{entry.type}</span>
            {#if entry.target}
              <span class="shrink-0 text-surface-200">{entry.target}</span>
            {/if}
            <span class="shrink-0 {entry.success ? 'text-surface-300' : 'text-danger'}">
              {#each formatLogMessage(entry.message) as seg, i (i)}
                {#if seg.type === 'code'}
                  <span class="px-1 py-px rounded-xs bg-surface-700/50 text-brand-400 text-[10px]">{seg.text}</span>
                {:else if seg.type === 'url'}
                  <span class="px-1 py-px rounded-xs bg-surface-700/50 text-brand-400 text-[10px]">{seg.text}</span>
                {:else}
                  {seg.text}
                {/if}
              {/each}
            </span>
          </div>

          <!-- Expanded detail panel -->
          {#if entry.detail && expandedId === entry.id}
            {@const detail = entry.detail}
            <div class="sl-detail" style="border-bottom: 1px solid var(--border-muted)">
              <!-- Tab bar -->
              <div class="flex gap-0 px-3 pt-2 pb-1">
                <button
                  class="sl-detail-tab"
                  class:sl-detail-tab--active={detailTab === 'request'}
                  onclick={() => { detailTab = 'request' }}
                >Request</button>
                <button
                  class="sl-detail-tab"
                  class:sl-detail-tab--active={detailTab === 'response'}
                  onclick={() => { detailTab = 'response' }}
                >Response</button>
              </div>

              <div class="sl-detail-body px-3 pb-2">
                {#if detailTab === 'request'}
                  <!-- URL -->
                  <div class="sl-detail-section">
                    <span class="sl-detail-label">URL</span>
                    <span class="text-surface-200 break-all whitespace-normal">{detail.request.url}</span>
                  </div>

                  <!-- Query Params -->
                  {#if detail.request.queryParams && Object.keys(detail.request.queryParams).length > 0}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Query Params</span>
                      <div class="sl-kv-list">
                        {#each Object.entries(detail.request.queryParams) as [key, value] (key)}
                          <div class="sl-kv-row">
                            <span class="sl-kv-key">{key}</span>
                            <span class="sl-kv-value">{value}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Headers -->
                  {#if Object.keys(detail.request.headers).length > 0}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Headers</span>
                      <div class="sl-kv-list">
                        {#each Object.entries(detail.request.headers) as [key, value] (key)}
                          <div class="sl-kv-row">
                            <span class="sl-kv-key">{key}</span>
                            <span class="sl-kv-value">{value}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Body -->
                  {#if detail.request.body}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Body{detail.request.bodyType ? ` (${detail.request.bodyType})` : ''}</span>
                      <pre class="sl-detail-pre">{formatDetailBody(detail.request.body, detail.request.headers)}</pre>
                    </div>
                  {/if}

                {:else}
                  <!-- Status + timing -->
                  <div class="sl-detail-section">
                    <span class="sl-detail-label">Status</span>
                    <span class="{detail.response.status >= 200 && detail.response.status < 400 ? 'text-success' : detail.response.status === 0 ? 'text-danger' : 'text-warning'}">
                      {detail.response.status} {detail.response.statusText}
                    </span>
                    <span class="text-surface-500 ml-2">
                      TTFB {detail.response.timing.ttfb}ms &middot; Total {detail.response.timing.total}ms &middot; {formatDetailSize(detail.response.size)}
                    </span>
                  </div>

                  <!-- Headers -->
                  {#if Object.keys(detail.response.headers).length > 0}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Headers</span>
                      <div class="sl-kv-list">
                        {#each Object.entries(detail.response.headers) as [key, value] (key)}
                          <div class="sl-kv-row">
                            <span class="sl-kv-key">{key}</span>
                            <span class="sl-kv-value">{value}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Body -->
                  {#if detail.response.body}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Body</span>
                      <pre class="sl-detail-pre">{formatDetailBody(detail.response.body, detail.response.headers)}</pre>
                    </div>
                  {/if}

                  <!-- Cookies -->
                  {#if detail.response.cookies && detail.response.cookies.length > 0}
                    <div class="sl-detail-section">
                      <span class="sl-detail-label">Cookies</span>
                      <div class="sl-kv-list">
                        {#each detail.response.cookies as cookie (cookie.name)}
                          <div class="sl-kv-row">
                            <span class="sl-kv-key">{cookie.name}</span>
                            <span class="sl-kv-value">{cookie.value}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Drag handle — matches sidebar/request divider style */
  .sl-drag {
    height: 1px;
    background: var(--border-subtle);
    position: relative;
    transition: background 0.15s, height 0.15s;
  }

  .sl-drag::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 3px;
    border-radius: 9999px;
    background: transparent;
    transition: background 0.15s;
  }

  .sl-drag::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -3px;
    bottom: -3px;
  }

  .sl-drag:hover {
    height: 3px;
    background: var(--tint-subtle);
  }

  .sl-drag:hover::before {
    background: color-mix(in srgb, var(--color-brand-500) 40%, transparent);
  }

  /* Chevron rotation transition */
  .sl-tab-chevron {
    transition: transform 0.15s;
  }

  .sl-tab-chevron--open {
    transform: rotate(180deg);
  }

  /* Row chevron */
  .sl-row-chevron {
    transition: transform 0.15s;
  }

  .sl-row-chevron--open {
    transform: rotate(90deg);
  }

  /* Log content — thin scrollbar for both axes */
  .sl-log-content {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-surface-500) 30%, transparent) transparent;
  }

  .sl-log-content::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  .sl-log-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .sl-log-content::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-surface-500) 30%, transparent);
    border-radius: 4px;
  }

  .sl-log-content::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--color-surface-500) 50%, transparent);
  }

  /* Rows extend full width for horizontal scroll */
  .sl-log-row {
    min-width: max-content;
    padding-right: 1rem;
  }

  /* Badge with dynamic --cat-color CSS variable */
  .sl-badge {
    flex-shrink: 0;
    width: 48px;
    text-align: center;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-size: calc(10px + var(--ui-bump));
    font-weight: 500;
    color: var(--cat-color);
    background: color-mix(in srgb, var(--cat-color) 12%, transparent);
  }

  /* Detail panel */
  .sl-detail {
    background: color-mix(in srgb, var(--color-surface-900) 60%, transparent);
    max-height: 300px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-surface-500) 30%, transparent) transparent;
  }

  .sl-detail::-webkit-scrollbar {
    width: 4px;
  }

  .sl-detail::-webkit-scrollbar-track {
    background: transparent;
  }

  .sl-detail::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-surface-500) 30%, transparent);
    border-radius: 4px;
  }

  /* Detail tabs */
  .sl-detail-tab {
    padding: 3px 10px;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: calc(10px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-500);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: color 0.1s, background 0.1s;
  }

  .sl-detail-tab:hover {
    color: var(--color-surface-300);
  }

  .sl-detail-tab--active {
    color: var(--color-brand-400);
    background: color-mix(in srgb, var(--color-brand-500) 10%, transparent);
  }

  /* Detail body area */
  .sl-detail-body {
    font-size: calc(11px + var(--ui-bump));
  }

  .sl-detail-section {
    margin-bottom: 8px;
  }

  .sl-detail-label {
    display: block;
    font-size: calc(10px + var(--ui-bump));
    font-weight: 600;
    color: var(--color-surface-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  /* Key-value list */
  .sl-kv-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sl-kv-row {
    display: flex;
    gap: 8px;
    padding: 1px 0;
  }

  .sl-kv-key {
    flex-shrink: 0;
    color: var(--color-surface-300);
    font-weight: 500;
  }

  .sl-kv-value {
    color: var(--color-surface-400);
    word-break: break-all;
    white-space: normal;
  }

  /* Pre block for bodies */
  .sl-detail-pre {
    margin: 2px 0 0;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--color-surface-900) 80%, transparent);
    border-radius: var(--radius-sm);
    font-size: calc(10px + var(--ui-bump));
    line-height: 1.5;
    color: var(--color-surface-300);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 12rem;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-surface-500) 30%, transparent) transparent;
  }

  .sl-detail-pre::-webkit-scrollbar {
    width: 4px;
  }

  .sl-detail-pre::-webkit-scrollbar-track {
    background: transparent;
  }

  .sl-detail-pre::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-surface-500) 30%, transparent);
    border-radius: 4px;
  }
</style>
