<script lang="ts">
  import Modal from '../shared/Modal.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import { appStore } from '../../lib/stores/app.svelte'

  interface Props {
    onselect: (collectionId: string) => void
    onclose: () => void
  }

  let { onselect, onclose }: Props = $props()

  let creating = $state(false)
  let newName = $state('')
  let search = $state('')
  let inputEl = $state<HTMLInputElement | null>(null)

  let filtered = $derived(
    search.trim()
      ? collectionsStore.collections.filter((c) =>
          c.name.toLowerCase().includes(search.trim().toLowerCase())
        )
      : collectionsStore.collections
  )

  function startCreate(): void {
    creating = true
    requestAnimationFrame(() => inputEl?.focus())
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const col = await collectionsStore.createCollection(name, appStore.activeWorkspaceId ?? undefined)
    onselect(col.id)
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') {
      e.stopPropagation()
      creating = false
      newName = ''
    }
  }
</script>

<Modal title="Save to Collection" {onclose} width="max-w-sm">
  <!-- New collection (always first) -->
  {#if creating}
    <div class="cp-create-row">
      <input
        bind:this={inputEl}
        bind:value={newName}
        onkeydown={handleKeydown}
        placeholder="Collection name"
        class="cp-create-input"
      />
      <button class="cp-create-btn" onclick={handleCreate} disabled={!newName.trim()}>Create</button>
    </div>
  {:else}
    <button class="cp-item cp-item--new" onclick={startCreate}>
      <svg class="cp-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
      </svg>
      <span class="cp-name">New collection</span>
    </button>
  {/if}

  <!-- Search -->
  <input
    bind:value={search}
    placeholder="Search collections..."
    class="cp-search"
  />

  <!-- Collection list -->
  <div class="cp-list">
    {#each filtered as col (col.id)}
      <button class="cp-item" onclick={() => onselect(col.id)}>
        <svg class="cp-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
        </svg>
        <span class="cp-name">{col.name}</span>
      </button>
    {:else}
      <p class="cp-empty">No collections found</p>
    {/each}
  </div>
</Modal>

<style>
  .cp-search {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    margin: 8px 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--color-surface-800);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s;
  }

  .cp-search:focus {
    border-color: var(--color-brand-500);
  }

  .cp-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }

  .cp-empty {
    font-size: calc(12px + var(--ui-bump));
    color: var(--color-surface-500);
    text-align: center;
    padding: 12px 0;
    margin: 0;
  }

  .cp-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-surface-200);
    font-size: calc(13px + var(--ui-bump));
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s;
    text-align: left;
  }

  .cp-item:hover {
    background: var(--tint-active);
  }

  .cp-item--new {
    color: var(--color-brand-400);
  }

  .cp-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .cp-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cp-create-row {
    display: flex;
    gap: 6px;
    padding: 4px 0;
  }

  .cp-create-input {
    flex: 1;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--color-surface-600);
    border-radius: 6px;
    background: var(--color-surface-800);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s;
  }

  .cp-create-input:focus {
    border-color: var(--color-brand-500);
  }

  .cp-create-btn {
    padding: 0 12px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: var(--color-brand-600);
    color: white;
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .cp-create-btn:not(:disabled):hover {
    background: var(--color-brand-500);
  }

  .cp-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
