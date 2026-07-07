<script lang="ts">
  import { onMount } from 'svelte'
  import Modal from '../shared/Modal.svelte'
  import type {
    RequestRunResult,
    CollectionRunResult,
    RunnerStartedEvent,
    RunnerProgressEvent,
  } from '@shared/types/runner'

  interface Props {
    collectionId: string
    collectionName: string
    workspaceId?: string
    onclose: () => void
  }

  let { collectionId, collectionName, workspaceId, onclose }: Props = $props()

  let running = $state(true)
  let runId = $state<string | null>(null)
  let total = $state(0)
  let completed = $state(0)
  let results = $state<RequestRunResult[]>([])
  let summary = $state<CollectionRunResult | null>(null)

  const methodColors: Record<string, string> = {
    GET: 'var(--color-method-get)',
    POST: 'var(--color-method-post)',
    PUT: 'var(--color-method-put)',
    PATCH: 'var(--color-method-patch)',
    DELETE: 'var(--color-method-delete)',
    QUERY: 'var(--color-method-query)',
    HEAD: 'var(--color-method-head)',
    OPTIONS: 'var(--color-method-options)',
  }

  let progressPercent = $derived(total > 0 ? (completed / total) * 100 : 0)

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  function formatTests(result: RequestRunResult): string {
    if (!result.assertionResults || result.assertionResults.length === 0) return '\u2014'
    const passed = result.assertionResults.filter((a) => a.passed).length
    return `${passed}/${result.assertionResults.length}`
  }

  function handleCancel(): void {
    if (runId) {
      window.api.runner.cancel(runId)
    }
    running = false
  }

  function handleClose(): void {
    if (!running) {
      onclose()
    }
  }

  onMount(() => {
    const cleanups: Array<() => void> = []

    cleanups.push(
      window.api.on.runnerStarted((data: RunnerStartedEvent) => {
        runId = data.runId
        total = data.total
      })
    )

    cleanups.push(
      window.api.on.runnerProgress((data: RunnerProgressEvent) => {
        results = [...results, data.result]
        completed = data.index + 1
      })
    )

    cleanups.push(
      window.api.on.runnerComplete((data: CollectionRunResult) => {
        summary = data
        running = false
      })
    )

    window.api.runner.start(collectionId, workspaceId)

    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  })
</script>

<Modal title="Run Collection: {collectionName}" onclose={handleClose} width="max-w-2xl">
  <!-- Progress section -->
  {#if running}
    <div class="mb-4">
      <div class="h-1 rounded-full bg-surface-700">
        <div
          class="h-1 rounded-full bg-brand-400 transition-[width] duration-300"
          style="width: {progressPercent}%"
        ></div>
      </div>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-xs text-surface-400">Running {completed} of {total}...</span>
        <button
          onclick={handleCancel}
          class="text-xs text-danger-light hover:text-danger-lighter"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Summary section -->
  {#if summary}
    <div class="mb-4 flex items-center gap-4 text-xs">
      <span class="text-surface-300">Total: <span class="font-medium text-surface-100">{summary.total}</span></span>
      <span class="text-surface-300">Passed: <span class="font-medium text-green-400">{summary.passed}</span></span>
      {#if summary.failed > 0}
        <span class="text-surface-300">Failed: <span class="font-medium text-red-400">{summary.failed}</span></span>
      {/if}
      {#if summary.skipped > 0}
        <span class="text-surface-300">Skipped: <span class="font-medium text-yellow-400">{summary.skipped}</span></span>
      {/if}
      <span class="text-surface-300">Duration: <span class="font-medium text-surface-100">{formatDuration(summary.timing)}</span></span>
    </div>
  {/if}

  <!-- Results table -->
  {#if results.length > 0}
    <div class="max-h-[400px] overflow-y-auto rounded-lg border border-surface-700/50">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-[10px] uppercase tracking-widest text-surface-500 font-medium bg-surface-800 sticky top-0">
            <th class="px-3 py-2 text-left w-8"></th>
            <th class="px-3 py-2 text-left">Method</th>
            <th class="px-3 py-2 text-left">Name</th>
            <th class="px-3 py-2 text-left">Status</th>
            <th class="px-3 py-2 text-right">Time</th>
            <th class="px-3 py-2 text-right">Tests</th>
          </tr>
        </thead>
        <tbody>
          {#each results as result, i (result.requestId + '-' + i)}
            <tr class="border-b border-surface-700/50 hover:bg-surface-700/30">
              <td class="px-3 py-2">
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  style="background: {result.passed ? '#4ade80' : '#f87171'}"
                ></span>
              </td>
              <td class="px-3 py-2">
                <span
                  class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style="color: {methodColors[result.method] ?? 'var(--color-surface-400)'}"
                >
                  {result.method}
                </span>
              </td>
              <td class="px-3 py-2 text-surface-200 truncate max-w-[200px]">{result.requestName}</td>
              <td class="px-3 py-2 font-mono text-surface-300">{result.status}</td>
              <td class="px-3 py-2 text-right font-mono text-surface-400">{formatDuration(result.timing)}</td>
              <td class="px-3 py-2 text-right font-mono text-surface-400">{formatTests(result)}</td>
            </tr>
            {#if result.error}
              <tr class="border-b border-surface-700/50">
                <td colspan="6" class="px-3 py-1.5 text-[11px] text-red-400">{result.error}</td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Bottom bar -->
  {#if !running}
    <div class="mt-4 flex justify-end">
      <button
        onclick={onclose}
        class="px-4 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-200 hover:bg-surface-600 border border-surface-600"
      >
        Close
      </button>
    </div>
  {/if}
</Modal>
