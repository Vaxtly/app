<script lang="ts">
  import Modal from '../shared/Modal.svelte'
  import type { ParsedCurl } from '../../../shared/curl-parser'
  import { getMethodColor } from '../../lib/utils/http-colors'

  interface Props {
    parsed: ParsedCurl
    rawCurl: string
    onimport: () => void
    onclose: () => void
  }

  let { parsed, rawCurl, onimport, onclose }: Props = $props()

  let displayUrl = $derived(() => {
    const url = parsed.url
    if (url.length > 80) return url.slice(0, 77) + '...'
    return url
  })

  let headerCount = $derived(parsed.headers.length)
  let paramCount = $derived(parsed.queryParams.length)
  let hasBody = $derived(parsed.body_type !== 'none' && parsed.body != null)
  let hasAuth = $derived(parsed.auth != null)
</script>

<Modal title="cURL Detected" onclose={onclose} width="max-w-md">
  <div class="space-y-4">
    <p class="text-sm text-surface-300">
      Your clipboard contains a cURL command. Import it as a new request?
    </p>

    <!-- Preview -->
    <div class="rounded-xl p-3 space-y-2" style="background: var(--tint-subtle); border: 1px solid var(--glass-border)">
      <!-- Method + URL -->
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold"
          style="color: {getMethodColor(parsed.method)}; background: color-mix(in srgb, {getMethodColor(parsed.method)} 12%, transparent)"
        >
          {parsed.method}
        </span>
        <span class="truncate font-mono text-xs text-surface-200">
          {displayUrl()}
        </span>
      </div>

      <!-- Tags -->
      <div class="flex flex-wrap gap-1.5">
        {#if headerCount > 0}
          <span class="curl-tag">{headerCount} header{headerCount > 1 ? 's' : ''}</span>
        {/if}
        {#if paramCount > 0}
          <span class="curl-tag">{paramCount} param{paramCount > 1 ? 's' : ''}</span>
        {/if}
        {#if hasBody}
          <span class="curl-tag">{parsed.body_type} body</span>
        {/if}
        {#if hasAuth}
          <span class="curl-tag">{parsed.auth?.type} auth</span>
        {/if}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2">
      <button
        onclick={onclose}
        class="rounded-xl px-4 py-2 text-xs font-medium text-surface-400 transition-colors duration-150 hover:text-surface-200 hover:bg-[var(--tint-subtle)]"
      >
        Dismiss
      </button>
      <button
        onclick={onimport}
        class="curl-import-btn rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150"
      >
        Import Request
      </button>
    </div>
  </div>
</Modal>

<style>
  .curl-tag {
    padding: 1px 6px;
    border-radius: 6px;
    font-size: calc(10px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-400);
    background: var(--tint-muted);
  }

  .curl-import-btn {
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-300);
    border: 1px solid color-mix(in srgb, var(--color-brand-500) 25%, transparent);
  }

  .curl-import-btn:hover {
    background: color-mix(in srgb, var(--color-brand-500) 25%, transparent);
    color: var(--color-brand-200);
    border-color: color-mix(in srgb, var(--color-brand-500) 40%, transparent);
  }
</style>
