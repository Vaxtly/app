<script lang="ts">
  import { collectionsStore, type TreeNode } from '../../lib/stores/collections.svelte'
  import { appStore } from '../../lib/stores/app.svelte'
  import { dragStore } from '../../lib/stores/drag.svelte'
  import ContextMenu from '../shared/ContextMenu.svelte'
  import DeleteSyncedModal from '../modals/DeleteSyncedModal.svelte'
  import SensitiveDataModal from '../modals/SensitiveDataModal.svelte'
  import CollectionRunnerModal from '../modals/CollectionRunnerModal.svelte'
  import FolderItem from './FolderItem.svelte'
  import RequestItem from './RequestItem.svelte'

  interface Props {
    node: TreeNode
    onrequestclick: (requestId: string) => void
  }

  let { node, onrequestclick }: Props = $props()

  let showDeleteSyncedModal = $state(false)
  let sensitiveFindings = $state<{ source: string; requestName: string | null; requestId: string | null; field: string; key: string; maskedValue: string }[]>([])
  let showSensitiveModal = $state(false)
  let showRunnerModal = $state(false)
  let renaming = $state(false)
  let renameValue = $state('')
  let contextMenu = $state<{ x: number; y: number } | null>(null)
  let inputEl = $state<HTMLInputElement | null>(null)

  function handleToggle(): void {
    collectionsStore.toggleExpanded(node.id)
  }

  function handleContextMenu(e: MouseEvent): void {
    e.preventDefault()
    contextMenu = { x: e.clientX, y: e.clientY }
  }

  function startRename(): void {
    renameValue = node.name
    renaming = true
    requestAnimationFrame(() => inputEl?.select())
  }

  async function commitRename(): Promise<void> {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      await collectionsStore.renameCollection(node.id, trimmed)
    }
    renaming = false
  }

  function handleRenameKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') renaming = false
  }

  async function addFolder(): Promise<void> {
    await collectionsStore.createFolder(node.id, 'New Folder')
  }

  async function addRequest(): Promise<void> {
    const req = await collectionsStore.createRequest(node.id, 'New Request')
    onrequestclick(req.id)
  }

  async function addWebSocket(): Promise<void> {
    const req = await collectionsStore.createWebSocket(node.id)
    onrequestclick(req.id)
  }

  async function handleDelete(): Promise<void> {
    if (syncEnabled) {
      showDeleteSyncedModal = true
      return
    }
    await collectionsStore.deleteCollection(node.id)
  }

  async function handleDeleteSynced(resolution: 'local-only' | 'everywhere'): Promise<void> {
    showDeleteSyncedModal = false
    if (resolution === 'everywhere') {
      const wsId = appStore.activeWorkspaceId ?? undefined
      await window.api.sync.deleteRemote(node.id, wsId)
    }
    await collectionsStore.deleteCollection(node.id)
  }

  // Sync state from the raw collection data
  let collection = $derived(collectionsStore.getCollectionById(node.id))
  let syncEnabled = $derived(collection?.sync_enabled === 1)
  let isDirty = $derived(collection?.is_dirty === 1)

  async function toggleSync(): Promise<void> {
    if (!collection) return
    const enabling = !syncEnabled
    await window.api.collections.update(node.id, { sync_enabled: enabling ? 1 : 0 })
    await collectionsStore.reloadCollection(node.id)
    if (enabling) {
      await pushCollection()
    }
  }

  let isDropTarget = $derived(dragStore.dropTargetId === node.id)

  function handleDragOver(e: DragEvent): void {
    if (dragStore.dragging?.type === 'request' && dragStore.dragging.id !== node.id) {
      e.preventDefault()
      dragStore.setDropTarget(node.id)
    }
  }

  function handleDragLeave(): void {
    if (dragStore.dropTargetId === node.id) {
      dragStore.setDropTarget(null)
    }
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragStore.setDropTarget(null)
    const dragging = dragStore.dragging
    if (dragging?.type === 'request') {
      const sourceCollectionId = dragging.collectionId
      await window.api.requests.move(dragging.id, null, node.id)
      await collectionsStore.reloadCollection(sourceCollectionId)
      if (sourceCollectionId !== node.id) {
        await collectionsStore.reloadCollection(node.id)
      }
      syncAfterMove(sourceCollectionId, node.id)
    }
    dragStore.endDrag()
  }

  function syncAfterMove(sourceId: string, targetId: string): void {
    const wsId = appStore.activeWorkspaceId ?? undefined
    const source = collectionsStore.getCollectionById(sourceId)
    const target = sourceId !== targetId ? collectionsStore.getCollectionById(targetId) : null
    if (source?.sync_enabled) {
      window.api.sync.pushCollection(sourceId, false, wsId).catch(() => {})
    }
    if (target?.sync_enabled) {
      window.api.sync.pushCollection(targetId, false, wsId).catch(() => {})
    }
  }

  async function exportCollection(): Promise<void> {
    try {
      const data = await window.api.data.exportCollection(node.id)
      const json = JSON.stringify(data, null, 2)
      const slug = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const date = new Date().toISOString().slice(0, 10)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vaxtly-collection-${slug}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Handled by session log
    }
  }

  async function exportOpenAPI(): Promise<void> {
    try {
      const yamlStr = await window.api.data.exportOpenAPI(node.id)
      const slug = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const date = new Date().toISOString().slice(0, 10)
      const blob = new Blob([yamlStr], { type: 'application/x-yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `openapi-${slug}-${date}.yaml`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Handled by session log
    }
  }

  async function exportPostmanCollection(): Promise<void> {
    try {
      const data = await window.api.data.exportPostman(node.id)
      const json = JSON.stringify(data, null, 2)
      const slug = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const date = new Date().toISOString().slice(0, 10)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `postman-collection-${slug}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Handled by session log
    }
  }

  async function pullCollection(): Promise<void> {
    try {
      const wsId = appStore.activeWorkspaceId ?? undefined
      await window.api.sync.pullCollection(node.id, wsId)
      await collectionsStore.reloadCollection(node.id)
    } catch {
      // Handled by sync service / session log
    }
  }

  async function pushCollection(): Promise<void> {
    try {
      // Scan for sensitive data first
      const findings = await window.api.sync.scanSensitive(node.id)
      if (findings.length > 0) {
        sensitiveFindings = findings
        showSensitiveModal = true
        return
      }
      const wsId = appStore.activeWorkspaceId ?? undefined
      await window.api.sync.pushCollection(node.id, false, wsId)
      await collectionsStore.reloadCollection(node.id)
    } catch {
      // Handled by sync service / session log
    }
  }

  async function pushAnyway(): Promise<void> {
    showSensitiveModal = false
    try {
      const wsId = appStore.activeWorkspaceId ?? undefined
      await window.api.sync.pushCollection(node.id, false, wsId)
      await collectionsStore.reloadCollection(node.id)
    } catch {
      // Handled by sync service / session log
    }
  }

  async function pushSanitized(): Promise<void> {
    showSensitiveModal = false
    try {
      const wsId = appStore.activeWorkspaceId ?? undefined
      await window.api.sync.pushCollection(node.id, true, wsId)
      await collectionsStore.reloadCollection(node.id)
    } catch {
      // Handled by sync service / session log
    }
  }

  let contextMenuItems = $derived([
    { label: 'Add Request', action: addRequest, icon: 'M12 4.5v15m7.5-7.5h-15' },
    { label: 'Add WebSocket', action: addWebSocket, icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
    { label: 'Add Folder', action: addFolder, icon: 'M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z' },
    { label: '', action: () => {}, separator: true },
    { label: 'Run Collection', action: () => { showRunnerModal = true }, icon: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z' },
    { label: 'Rename', action: startRename, icon: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z' },
    { label: '', action: () => {}, separator: true },
    { label: 'Settings', action: () => { appStore.openCollectionEditorTab({ id: node.id, name: node.name }) }, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: syncEnabled ? 'Disable Sync' : 'Enable Sync', action: toggleSync, icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992' },
    ...(syncEnabled ? [
      { label: '', action: () => {}, separator: true },
      { label: 'Push to Remote', action: pushCollection, icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' },
      { label: 'Pull from Remote', action: pullCollection, icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3' },
    ] : []),
    { label: '', action: () => {}, separator: true },
    { label: 'Export', action: exportCollection, icon: 'M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0 12.814a2.25 2.25 0 1 0 3.933 2.185 2.25 2.25 0 0 0-3.933-2.185Z' },
    { label: 'Export as OpenAPI', action: exportOpenAPI, icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
    { label: 'Export as Postman Collection', action: exportPostmanCollection, icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
    { label: '', action: () => {}, separator: true },
    { label: 'Delete', action: handleDelete, danger: true, icon: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0' },
  ])
</script>

<!-- Collection header -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="group" oncontextmenu={handleContextMenu} ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex w-full cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-left transition-all duration-150 {isDropTarget ? 'border border-brand-500 bg-brand-500/10' : 'hover:bg-[var(--tint-hover)]'}"
    role="button"
    tabindex="0"
    aria-expanded={node.expanded}
    onclick={handleToggle}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle() } }}
  >
    <!-- Chevron -->
    <svg
      class="h-3.5 w-3.5 shrink-0 text-surface-500 transition-transform {node.expanded ? 'rotate-90' : ''}"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>

    <!-- Sync indicator -->
    {#if syncEnabled}
      <svg class="h-3 w-3 shrink-0" style:color={isDirty ? 'var(--color-warning)' : 'var(--color-success)'} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" title={isDirty ? 'Unsaved changes' : 'Synced'}>
        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    {:else}
      <!-- Folder icon -->
      <svg class="h-3.5 w-3.5 shrink-0 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    {/if}

    {#if renaming}
      <input
        bind:this={inputEl}
        bind:value={renameValue}
        onblur={commitRename}
        onkeydown={handleRenameKeydown}
        class="h-5 min-w-0 flex-1 rounded-md border border-brand-500/50 bg-[var(--tint-muted)] px-1 text-xs text-surface-100 outline-none"
      />
    {:else}
      <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-surface-200">
        {node.name}
      </span>
    {/if}

    <!-- Add button (visible on hover) -->
    <button
      onclick={(e) => { e.stopPropagation(); addRequest() }}
      aria-label="Add request to collection"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-surface-500 opacity-0 transition-all duration-150 hover:bg-[var(--tint-active)] hover:text-brand-400 group-hover:opacity-100"
    >
      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
</div>

<!-- Children -->
{#if node.expanded}
  <div class="ml-3 pl-1" style="border-left: 1px solid var(--border-muted)">
    {#each node.children as child (child.id)}
      {#if child.type === 'folder'}
        <FolderItem node={child} {onrequestclick} />
      {:else if child.type === 'request'}
        <RequestItem node={child} {onrequestclick} />
      {/if}
    {/each}
  </div>
{/if}

{#if contextMenu}
  <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onclose={() => contextMenu = null} />
{/if}


{#if showDeleteSyncedModal}
  <DeleteSyncedModal
    name={node.name}
    ondelete={handleDeleteSynced}
    onclose={() => { showDeleteSyncedModal = false }}
  />
{/if}

{#if showSensitiveModal}
  <SensitiveDataModal
    findings={sensitiveFindings}
    onclose={() => { showSensitiveModal = false }}
    onsyncanyway={pushAnyway}
    onsyncwithout={pushSanitized}
  />
{/if}

{#if showRunnerModal}
  <CollectionRunnerModal
    collectionId={node.id}
    collectionName={node.name}
    workspaceId={appStore.activeWorkspaceId ?? undefined}
    onclose={() => { showRunnerModal = false }}
  />
{/if}
