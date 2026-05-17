<script lang="ts">
  import CodeEditor from '../CodeEditor.svelte'

  interface Props {
    message: string
    messageType: 'text' | 'json'
    connected: boolean
    onmessagechange: (value: string) => void
    ontypechange: (type: 'text' | 'json') => void
    onsend: () => void
  }

  let { message, messageType, connected, onmessagechange, ontypechange, onsend }: Props = $props()

  let textareaEl = $state<HTMLTextAreaElement | null>(null)

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (connected && message.trim()) {
        onsend()
      }
    }
  }

  function handleInput(e: Event): void {
    onmessagechange((e.target as HTMLTextAreaElement).value)
  }

  function formatJson(): void {
    try {
      const parsed = JSON.parse(message)
      onmessagechange(JSON.stringify(parsed, null, 2))
    } catch {
      // Not valid JSON
    }
  }

  export function focus(): void {
    textareaEl?.focus()
  }
</script>

<div class="flex flex-col" style="border-top: 1px solid var(--glass-border)">
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-3 py-1.5" style="border-bottom: 1px solid var(--glass-border)">
    <div class="flex items-center gap-1">
      <button
        class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {messageType === 'text' ? 'bg-[var(--tint-active)] text-surface-200' : 'text-surface-500 hover:text-surface-300'}"
        onclick={() => ontypechange('text')}
      >
        Text
      </button>
      <button
        class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {messageType === 'json' ? 'bg-[var(--tint-active)] text-surface-200' : 'text-surface-500 hover:text-surface-300'}"
        onclick={() => ontypechange('json')}
      >
        JSON
      </button>
      {#if messageType === 'json'}
        <button
          onclick={formatJson}
          class="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-surface-500 transition-colors hover:bg-[var(--tint-hover)] hover:text-surface-300"
        >
          Format
        </button>
      {/if}
    </div>

    <button
      onclick={onsend}
      disabled={!connected || !message.trim()}
      class="btn-send-msg flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Send
    </button>
  </div>

  <!-- Editor -->
  {#if messageType === 'json'}
    <div class="composer-editor h-[120px]">
      <CodeEditor
        value={message}
        language="json"
        placeholder={"Type JSON... (Enter to send, Shift+Enter for new line)"}
        onchange={onmessagechange}
      />
    </div>
  {:else}
    <textarea
      bind:this={textareaEl}
      value={message}
      oninput={handleInput}
      onkeydown={handleKeydown}
      disabled={!connected}
      placeholder={connected ? 'Type a message... (Enter to send, Shift+Enter for new line)' : 'Connect to send messages'}
      rows="4"
      class="w-full resize-none border-none bg-transparent px-3 py-2 font-mono text-sm text-surface-200 outline-none placeholder:text-surface-600 disabled:opacity-50 disabled:cursor-not-allowed"
      spellcheck="false"
    ></textarea>
  {/if}
</div>

<style>
  .btn-send-msg {
    color: var(--color-method-ws);
    background: color-mix(in srgb, var(--color-method-ws) 10%, transparent);
  }
  .btn-send-msg:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-method-ws) 20%, transparent);
    filter: brightness(1.1);
  }

  .composer-editor :global(.cm-editor) {
    border: none;
    border-radius: 0;
    background: transparent;
  }
  .composer-editor :global(.cm-scroller) {
    font-size: calc(13px + var(--ui-bump));
  }
</style>
