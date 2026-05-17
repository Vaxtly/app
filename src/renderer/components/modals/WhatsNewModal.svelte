<script lang="ts">
  import { settingsStore } from '../../lib/stores/settings.svelte'

  interface Props {
    open: boolean
    onclose: () => void
  }

  let { open, onclose }: Props = $props()

  const version = $derived(settingsStore.get('app.version'))

  const DOCS_URL = 'https://vaxtly.app/docs/ai-agents'

  function openDocs(): void {
    window.open(DOCS_URL, '_blank')
  }

  function dismiss(): void {
    onclose()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') dismiss()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[modal-backdrop-in_0.15s_ease-out]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="whatsnew-title"
    onkeydown={handleKeydown}
  >
    <button class="absolute inset-0" onclick={dismiss} aria-label="Close"></button>

    <div class="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-surface-700/50 bg-surface-900 shadow-xl animate-[modal-content-in_0.2s_ease-out]">
      <!-- Header -->
      <div class="px-8 pt-8 pb-5">
        <!-- Version badge -->
        <div class="mb-4 flex justify-center">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-brand-600/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-brand-400">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New in v{version}
          </span>
        </div>

        <!-- Feature icon -->
        <div class="mb-4 flex justify-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600/20">
            <svg class="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>

        <!-- Title -->
        <h2 id="whatsnew-title" class="mb-2 text-center text-xl font-semibold text-surface-100">
          AI Agent Integration
        </h2>

        <!-- Description -->
        <p class="text-center text-sm leading-relaxed text-surface-400">
          Stop clicking around to mirror endpoints. Tell your AI coding agent to add them for you — Vaxtly now ships with a CLI and an MCP server that any agent can drive.
        </p>
      </div>

      <!-- Try this quote -->
      <div class="mx-8 mb-5 rounded-lg border border-brand-600/30 bg-brand-600/5 px-4 py-3">
        <div class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-brand-400">
          Try this with your agent
        </div>
        <p class="font-mono text-sm text-surface-100">
          "Add the GET /users endpoint to Vaxtly"
        </p>
      </div>

      <!-- What it does -->
      <div class="mx-8 mb-5">
        <ul class="space-y-2 text-xs text-surface-400">
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Works with Cursor, Claude Code, Codex, Claude Desktop, and any MCP-capable client.</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Re-running on the same endpoint updates it — no duplicates.</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Local-only socket, encrypted secrets at rest, redacted on every read.</span>
          </li>
        </ul>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 border-t border-surface-700/50 px-6 py-3">
        <button
          onclick={openDocs}
          class="inline-flex items-center gap-1.5 rounded border border-surface-600 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800"
        >
          Read the guide
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
        <button
          onclick={dismiss}
          class="rounded bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
        >
          Got it
        </button>
      </div>
    </div>
  </div>
{/if}
