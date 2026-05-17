<script lang="ts">
  import { settingsStore } from '../../lib/stores/settings.svelte'

  interface Props {
    open: boolean
    onclose: () => void
  }

  let { open, onclose }: Props = $props()

  const steps = [
    {
      title: 'Welcome to Vaxtly',
      description: 'A powerful API testing tool that runs natively on your desktop. Your data stays local, syncs to your own Git repository, and integrates with HashiCorp Vault.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
    {
      title: 'Environments',
      description: 'Create environments (Development, Staging, Production) with variables like {{base_url}} and {{api_key}}. Switch between them instantly. Variables are auto-resolved in URLs, headers, and body.',
      icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2',
    },
    {
      title: 'WebSocket',
      description: 'Create WebSocket connections right alongside your HTTP requests. Connect, send messages with JSON syntax highlighting, and inspect responses in real-time. Variables work in URLs and messages.',
      icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    },
    {
      title: 'MCP Servers',
      description: 'Connect to Model Context Protocol servers to inspect tools, resources, and prompts. Supports stdio, HTTP, and SSE transports. View JSON-RPC traffic and server notifications in real-time.',
      icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z',
    },
    {
      title: 'AI Agent Integration',
      description: `Tell your AI coding agent "add this endpoint to Vaxtly" and it just does it. Works with Cursor, Claude Code, Codex, Claude Desktop, or anything that can shell out or speak MCP. Vaxtly ships a CLI and MCP server bundled with the app — they talk to a running Vaxtly over a local socket. Secrets are always redacted on read; no opt-in.`,
      icon: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z',
    },
    {
      title: 'Git Sync',
      description: 'Sync your collections to GitHub or GitLab. Your requests are serialized to readable YAML files. Sensitive data is detected and flagged before pushing. Conflicts are resolved via a simple prompt.',
      icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
    },
    {
      title: 'Vault Integration',
      description: 'Connect to HashiCorp Vault to manage secrets. Environment variables can be synced to and from Vault. Supports token and AppRole authentication.',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    },
    {
      title: 'Workspaces',
      description: 'Organize your work into separate workspaces. Each workspace has its own collections, environments, and settings. Great for separating personal and team projects.',
      icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z',
    },
  ]

  let currentStep = $state(0)

  function next(): void {
    if (currentStep < steps.length - 1) {
      currentStep++
    } else {
      finish()
    }
  }

  function prev(): void {
    if (currentStep > 0) currentStep--
  }

  function finish(): void {
    settingsStore.set('app.welcomed', true)
    onclose()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') finish()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[modal-backdrop-in_0.15s_ease-out]"
    role="dialog"
    aria-modal="true"
    onkeydown={handleKeydown}
  >
    <button class="absolute inset-0" onclick={finish} aria-label="Close"></button>

    <div class="relative z-10 flex w-full max-w-xl flex-col rounded-2xl border border-surface-700/50 bg-surface-900 shadow-xl animate-[modal-content-in_0.2s_ease-out]">
      <!-- Content -->
      <div class="px-8 pb-4 pt-8">
        <!-- Icon -->
        <div class="mb-4 flex justify-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600/20">
            <svg class="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path d={steps[currentStep].icon} />
            </svg>
          </div>
        </div>

        <!-- Title -->
        <h2 class="mb-2 text-center text-lg font-semibold text-surface-100">
          {steps[currentStep].title}
        </h2>

        <!-- Description -->
        <p class="text-center text-sm leading-relaxed text-surface-400">
          {steps[currentStep].description}
        </p>
      </div>

      <!-- Dots -->
      <div class="flex justify-center gap-1.5 py-4">
        {#each steps as _, i}
          <button
            onclick={() => { currentStep = i }}
            aria-label="Go to step {i + 1}"
            class="h-2 w-2 rounded-full transition-colors {i === currentStep ? 'bg-brand-500' : 'bg-surface-600 hover:bg-surface-500'}"
          ></button>
        {/each}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t border-surface-700/50 px-6 py-3">
        <button
          onclick={finish}
          class="text-xs text-surface-500 hover:text-surface-300"
        >
          Skip
        </button>
        <div class="flex gap-2">
          {#if currentStep > 0}
            <button
              onclick={prev}
              class="rounded border border-surface-600 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800"
            >
              Back
            </button>
          {/if}
          <button
            onclick={next}
            class="rounded bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
