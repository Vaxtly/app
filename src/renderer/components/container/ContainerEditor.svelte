<script lang="ts">
  import { setContext } from 'svelte'
  import { appStore } from '../../lib/stores/app.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import { environmentsStore } from '../../lib/stores/environments.svelte'
  import AuthEditor from '../request/AuthEditor.svelte'
  import KeyValueEditor from '../shared/KeyValueEditor.svelte'
  import ScriptsEditor from '../request/ScriptsEditor.svelte'
  import type { AuthConfig, KeyValueEntry, ScriptsConfig } from '../../lib/types'
  import type { ResolvedVariable } from '../../lib/utils/variable-highlight'

  interface Props {
    tabId: string
    entityId: string
    entityType: 'collection' | 'folder'
  }

  let { tabId, entityId, entityType }: Props = $props()

  // --- Variable resolution context (for VarInput inside AuthEditor) ---

  let resolvedVars = $state<Record<string, ResolvedVariable>>({})

  $effect(() => {
    void environmentsStore.activeEnvironmentId
    let cancelled = false
    window.api.variables.resolveWithSource(
      appStore.activeWorkspaceId ?? undefined,
      entityType === 'collection' ? entityId : undefined,
    ).then((result) => {
      if (!cancelled) resolvedVars = result as Record<string, ResolvedVariable>
    })
    return () => { cancelled = true }
  })

  setContext('resolvedVars', () => resolvedVars)

  // --- State from app store ---

  let state = $derived(appStore.getContainerEditorTabState(tabId))
  let activeSubTab = $derived(state?.activeSubTab ?? 'auth')
  let isDirty = $derived(state?.isDirty ?? false)
  let saving = $state(false)
  let envSearch = $state('')

  // Entity name from store
  let entityName = $derived.by(() => {
    if (entityType === 'collection') {
      return collectionsStore.getCollectionById(entityId)?.name ?? 'Collection'
    }
    return collectionsStore.getFolderById(entityId)?.name ?? 'Folder'
  })

  // Sub-tabs definition
  let subTabs = $derived(
    entityType === 'collection'
      ? [{ key: 'auth', label: 'Auth' }, { key: 'environments', label: 'Environments' }, { key: 'scripts', label: 'Scripts' }, { key: 'variables', label: 'Variables' }]
      : [{ key: 'auth', label: 'Auth' }, { key: 'environments', label: 'Environments' }, { key: 'scripts', label: 'Scripts' }]
  )

  // Scripts helpers
  let scripts = $derived<ScriptsConfig>(state?.scripts ?? {})

  // --- Environment helpers ---

  let selectedEnvIds = $derived(new Set(state?.environmentIds ?? []))

  let filteredEnvironments = $derived.by(() => {
    const q = envSearch.toLowerCase().trim()
    if (!q) return environmentsStore.environments
    return environmentsStore.environments.filter((e) => e.name.toLowerCase().includes(q))
  })

  function toggleEnv(id: string): void {
    const next = new Set(state?.environmentIds ?? [])
    if (next.has(id)) {
      next.delete(id)
      if (state?.defaultEnvironmentId === id) {
        updateState({ environmentIds: [...next], defaultEnvironmentId: null, isDirty: true })
        return
      }
    } else {
      next.add(id)
    }
    updateState({ environmentIds: [...next], isDirty: true })
  }

  function setDefault(id: string): void {
    const next = new Set(state?.environmentIds ?? [])
    if (!next.has(id)) next.add(id)
    const newDefault = state?.defaultEnvironmentId === id ? null : id
    updateState({ environmentIds: [...next], defaultEnvironmentId: newDefault, isDirty: true })
  }

  // --- Variables helpers (collection only) ---

  let collectionVarsAsKV = $derived.by((): KeyValueEntry[] => {
    const vars = state?.variables ?? []
    if (vars.length === 0) return [{ key: '', value: '', enabled: true }]
    return vars.map(v => ({ key: v.key, value: v.value, enabled: true }))
  })

  function handleVariablesChange(entries: KeyValueEntry[]): void {
    updateState({
      variables: entries.map(e => ({ key: e.key, value: e.value })),
      isDirty: true,
    })
  }

  // --- State update helper ---

  function updateState(partial: Parameters<typeof appStore.updateContainerEditorTabState>[1]): void {
    appStore.updateContainerEditorTabState(tabId, partial)
  }

  // --- Initialize from store on mount ---

  $effect(() => {
    if (!state || state.initialized) return

    if (entityType === 'collection') {
      const col = collectionsStore.getCollectionById(entityId)
      if (!col) return
      let auth: AuthConfig = { type: 'none' }
      try { if (col.auth) auth = JSON.parse(col.auth) } catch {}
      let envIds: string[] = []
      try { if (col.environment_ids) envIds = JSON.parse(col.environment_ids) } catch {}
      let vars: Array<{ key: string; value: string }> = []
      try { if (col.variables) vars = JSON.parse(col.variables) } catch {}

      let colScripts: ScriptsConfig = {}
      try { if (col.scripts) colScripts = JSON.parse(col.scripts) } catch {}

      appStore.updateContainerEditorTabState(tabId, {
        auth,
        environmentIds: envIds,
        defaultEnvironmentId: col.default_environment_id,
        variables: vars.length > 0 ? vars : [{ key: '', value: '' }],
        scripts: colScripts,
        isDirty: false,
        initialized: true,
      })
    } else {
      const folder = collectionsStore.getFolderById(entityId)
      if (!folder) return
      let auth: AuthConfig = { type: 'none' }
      try { if (folder.auth) auth = JSON.parse(folder.auth) } catch {}
      let envIds: string[] = []
      try { if (folder.environment_ids) envIds = JSON.parse(folder.environment_ids) } catch {}
      let fldScripts: ScriptsConfig = {}
      try { if (folder.scripts) fldScripts = JSON.parse(folder.scripts) } catch {}

      appStore.updateContainerEditorTabState(tabId, {
        auth,
        environmentIds: envIds,
        defaultEnvironmentId: folder.default_environment_id,
        scripts: fldScripts,
        isDirty: false,
        initialized: true,
      })
    }
  })

  // --- Save handler ---

  async function save(): Promise<void> {
    if (!state) return
    saving = true
    try {
      const authJson = JSON.stringify($state.snapshot(state.auth))
      const envIdsJson = JSON.stringify($state.snapshot(state.environmentIds))
      const scriptsJson = JSON.stringify($state.snapshot(state.scripts))

      if (entityType === 'collection') {
        const varsJson = JSON.stringify($state.snapshot(state.variables ?? []))
        await window.api.collections.update(entityId, {
          auth: authJson,
          environment_ids: envIdsJson,
          default_environment_id: state.defaultEnvironmentId,
          variables: varsJson,
          scripts: scriptsJson,
        })
        await collectionsStore.reloadCollection(entityId)
      } else {
        const folder = collectionsStore.getFolderById(entityId)
        await window.api.folders.update(entityId, {
          auth: authJson,
          environment_ids: envIdsJson,
          default_environment_id: state.defaultEnvironmentId,
          scripts: scriptsJson,
        })
        if (folder) await collectionsStore.reloadCollection(folder.collection_id)
      }
      appStore.updateContainerEditorTabState(tabId, { isDirty: false })
    } finally {
      saving = false
    }
  }

  // --- Keyboard shortcut ---

  function handleKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (isDirty && !saving) save()
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex h-full flex-col" onkeydown={handleKeydown}>
  <!-- Header bar (same pill style as EnvironmentEditor) -->
  <div class="flex shrink-0 items-center gap-2 px-3 py-2.5">
    <div class="ce-bar flex min-w-0 flex-1 items-center overflow-hidden rounded-xl transition-colors duration-150" style="border: 1px solid var(--glass-border); background: var(--tint-muted)">
      <!-- Entity type badge -->
      <div class="flex h-[38px] shrink-0 items-center gap-2 border-0 border-r border-solid px-3.5" style="border-color: var(--glass-border); background: var(--tint-subtle)">
        <svg class="h-3.5 w-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span class="text-xs font-bold font-mono tracking-wide whitespace-nowrap text-surface-400" style="font-feature-settings: var(--font-feature-mono)">{entityType === 'collection' ? 'Collection' : 'Folder'}</span>
      </div>

      <!-- Name (read only display) -->
      <span class="h-[38px] flex items-center px-3 text-[13px] font-medium text-surface-100 flex-1 min-w-0 truncate">{entityName}</span>

      <!-- Save button -->
      <button
        class="ce-save flex h-[38px] shrink-0 cursor-default items-center gap-[7px] border-0 border-l border-solid bg-transparent pl-3.5 pr-4 text-surface-500 whitespace-nowrap transition-all duration-200 disabled:cursor-default disabled:opacity-40"
        style="border-color: var(--glass-border)"
        class:ce-save--dirty={isDirty}
        disabled={!isDirty || saving}
        onclick={save}
      >
        {#if saving}
          <span class="ce-save-spinner"></span>
          <span class="text-[11px] font-bold font-mono tracking-widest uppercase" style="font-feature-settings: var(--font-feature-mono)">Saving...</span>
        {:else}
          <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-[11px] font-bold font-mono tracking-widest uppercase" style="font-feature-settings: var(--font-feature-mono)">Save</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Sub-tabs -->
  <div class="flex items-stretch shrink-0 h-9 px-1 gap-px" style="border-bottom: 1px solid var(--glass-border)">
    {#each subTabs as tab (tab.key)}
      <button
        onclick={() => updateState({ activeSubTab: tab.key })}
        class="ce-tab flex items-center gap-[5px] px-2.5 my-1 border-none bg-transparent text-xs font-inherit cursor-pointer relative whitespace-nowrap rounded-lg transition-all duration-150 {activeSubTab === tab.key ? 'ce-tab--active text-brand-400 bg-[var(--tint-active)] shadow-[inset_0_1px_0_var(--glass-highlight)] hover:text-brand-400' : 'text-surface-400 hover:text-surface-200 hover:bg-[var(--tint-subtle)]'}"
      >
        <span class="font-medium">{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Sub-tab content -->
  <div class="flex-1 overflow-auto">
    {#if activeSubTab === 'auth'}
      <AuthEditor
        auth={state?.auth ?? { type: 'none' }}
        showInherit={false}
        onchange={(a) => { updateState({ auth: a, isDirty: true }) }}
      />
    {:else if activeSubTab === 'environments'}
      <!-- Search bar (mirrors auth type selector bar) -->
      <div class="ce-env-toolbar">
        <input
          type="text"
          value={envSearch}
          oninput={(e) => { envSearch = (e.target as HTMLInputElement).value }}
          placeholder="Filter environments..."
          class="ce-env-search"
        />
        <span class="text-[10px] text-surface-500">{selectedEnvIds.size} selected</span>
      </div>

      <!-- Environment list -->
      <div class="ce-env-list">
        {#each filteredEnvironments as env (env.id)}
          {@const isSelected = selectedEnvIds.has(env.id)}
          {@const isDefault = state?.defaultEnvironmentId === env.id}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="ce-env-row"
            class:ce-env-row--selected={isSelected}
            onclick={() => toggleEnv(env.id)}
          >
            <span class="ce-env-check" class:ce-env-check--on={isSelected}>
              {#if isSelected}
                <svg class="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" /></svg>
              {/if}
            </span>

            <span class="min-w-0 flex-1 truncate text-left text-xs {isSelected ? 'text-surface-100' : 'text-surface-400'}">{env.name}</span>

            {#if isDefault}
              <span class="ce-env-default-badge">default</span>
            {/if}

            <button
              onclick={(e) => { e.stopPropagation(); setDefault(env.id) }}
              aria-label="Set {env.name} as default"
              class="ce-env-star"
              class:ce-env-star--active={isDefault}
            >
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            </button>
          </div>
        {/each}
        {#if filteredEnvironments.length === 0}
          <div class="py-6 text-center text-xs text-surface-500">No environments found</div>
        {/if}
      </div>
    {:else if activeSubTab === 'scripts'}
      <ScriptsEditor
        {scripts}
        collectionId={entityType === 'collection' ? entityId : collectionsStore.getFolderById(entityId)?.collection_id}
        requestId=""
        onchange={(s) => { updateState({ scripts: s, isDirty: true }) }}
      />
    {:else if activeSubTab === 'variables' && entityType === 'collection'}
      <div class="p-4">
        <div class="mb-2 text-xs font-medium uppercase text-surface-500">Collection Variables</div>
        <KeyValueEditor
          entries={collectionVarsAsKV}
          onchange={handleVariablesChange}
          keyPlaceholder="Variable name"
          valuePlaceholder="Variable value"
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .ce-bar:focus-within {
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand-500) 20%, transparent);
  }

  .ce-save--dirty {
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    color: var(--color-success);
    border-left-color: color-mix(in srgb, var(--color-success) 20%, transparent);
    cursor: pointer;
  }

  .ce-save--dirty:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-success) 20%, transparent);
  }

  .ce-save--dirty:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-success) 28%, transparent);
  }

  .ce-save-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid color-mix(in srgb, var(--color-success) 25%, transparent);
    border-top-color: var(--color-success);
    animation: spin-360 0.6s linear infinite;
    flex-shrink: 0;
  }

  /* --- Environments --- */
  .ce-env-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-default);
  }

  .ce-env-search {
    height: 26px;
    width: 200px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--color-surface-800);
    color: var(--color-surface-200);
    font-size: calc(11px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s;
  }

  .ce-env-search:hover {
    border-color: var(--color-surface-600);
  }

  .ce-env-search:focus {
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand-500) 15%, transparent);
  }

  .ce-env-search::placeholder {
    color: var(--color-surface-600);
  }

  .ce-env-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .ce-env-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 12px;
    border: none;
    background: transparent;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }

  .ce-env-row:hover {
    background: color-mix(in srgb, var(--color-surface-700) 40%, transparent);
  }

  .ce-env-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--color-surface-600);
    background: transparent;
    flex-shrink: 0;
    transition: background 0.1s, border-color 0.1s;
  }

  .ce-env-check--on {
    background: var(--color-brand-600);
    border-color: var(--color-brand-500);
  }

  .ce-env-star {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-700);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.1s;
    opacity: 0;
  }

  .ce-env-row:hover .ce-env-star,
  .ce-env-star--active {
    opacity: 1;
  }

  .ce-env-star:hover {
    color: var(--color-surface-400);
  }

  .ce-env-star--active {
    color: var(--color-warning);
  }

  .ce-env-star--active:hover {
    color: var(--color-warning);
  }

  .ce-env-default-badge {
    font-size: calc(9px + var(--ui-bump));
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-warning);
    opacity: 0.6;
    flex-shrink: 0;
  }
</style>
