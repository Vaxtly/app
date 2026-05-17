<script lang="ts">
  import { getContext } from 'svelte'
  import CodeEditor from '../CodeEditor.svelte'
  import KeyValueEditor from '../shared/KeyValueEditor.svelte'
  import VarInput from '../shared/VarInput.svelte'
  import Checkbox from '../shared/Checkbox.svelte'
  import type { KeyValueEntry, FormDataEntry } from '../../lib/types'
  import type { ResolvedVariable } from '../../lib/utils/variable-highlight'
  import type { GraphQLSchema } from 'graphql'
  import { formDataToBulk, bulkToFormData } from '../../lib/utils/bulk-edit'
  import { BODY_TYPES } from '../../../shared/constants'

  const getResolvedVars = getContext<(() => Record<string, ResolvedVariable>) | undefined>('resolvedVars')

  interface Props {
    bodyType: string
    body: string
    formData: FormDataEntry[]
    graphqlSchema?: GraphQLSchema | null
    schemaLoading?: boolean
    schemaError?: string | null
    onbodytypechange: (type: string) => void
    onbodychange: (body: string) => void
    onformdatachange: (data: FormDataEntry[]) => void
    onfetchschema?: () => void
  }

  let {
    bodyType,
    body,
    formData,
    graphqlSchema = null,
    schemaLoading = false,
    schemaError = null,
    onbodytypechange,
    onbodychange,
    onformdatachange,
    onfetchschema,
  }: Props = $props()

  let formatFeedback = $state('')
  let formDataBulkMode = $state(false)
  let formDataBulkText = $state('')

  // --- GraphQL body envelope: parse body JSON into query + variables ---
  function parseGraphqlBody(raw: string): { query: string; variables: string } {
    if (!raw) return { query: '', variables: '' }
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.query === 'string') {
        const vars = parsed.variables && Object.keys(parsed.variables).length > 0
          ? JSON.stringify(parsed.variables, null, 2)
          : ''
        return { query: parsed.query, variables: vars }
      }
    } catch { /* not JSON envelope — treat as bare query (backward compat) */ }
    return { query: raw, variables: '' }
  }

  function serializeGraphqlBody(query: string, variables: string): string {
    let vars: Record<string, unknown> = {}
    if (variables.trim()) {
      try { vars = JSON.parse(variables) } catch { /* keep empty */ }
    }
    return JSON.stringify({ query, variables: vars })
  }

  let gqlParsed = $derived(bodyType === 'graphql' ? parseGraphqlBody(body) : { query: '', variables: '' })

  function handleGraphqlQueryChange(newQuery: string): void {
    onbodychange(serializeGraphqlBody(newQuery, gqlParsed.variables))
  }

  function handleGraphqlVarsChange(newVars: string): void {
    onbodychange(serializeGraphqlBody(gqlParsed.query, newVars))
  }

  // --- GraphQL draggable splitter (query / variables) ---
  let gqlSplitPercent = $state(70)
  let gqlDragging = $state(false)
  let gqlSplitContainer = $state<HTMLElement | null>(null)

  function onGqlDividerPointerDown(e: PointerEvent): void {
    e.preventDefault()
    gqlDragging = true
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }

  function onGqlDividerPointerMove(e: PointerEvent): void {
    if (!gqlDragging || !gqlSplitContainer) return
    const rect = gqlSplitContainer.getBoundingClientRect()
    const pct = ((e.clientY - rect.top) / rect.height) * 100
    gqlSplitPercent = Math.min(90, Math.max(25, pct))
  }

  function onGqlDividerPointerUp(): void {
    gqlDragging = false
  }

  function onGqlDividerPointerCancel(): void {
    gqlDragging = false
  }

  function enterFormDataBulkMode(): void {
    formDataBulkText = formDataToBulk(formData)
    formDataBulkMode = true
  }

  function exitFormDataBulkMode(): void {
    formDataBulkMode = false
  }

  function handleFormDataBulkInput(e: Event): void {
    const value = (e.currentTarget as HTMLTextAreaElement).value
    formDataBulkText = value
    onformdatachange(bulkToFormData(value, formData))
  }

  function formatJson(): void {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2)
      onbodychange(formatted)
      formatFeedback = 'Formatted'
      setTimeout(() => formatFeedback = '', 1500)
    } catch {
      formatFeedback = 'Invalid JSON'
      setTimeout(() => formatFeedback = '', 2000)
    }
  }

  function formatXml(): void {
    // Simple XML indentation: split on >< boundaries and re-indent
    try {
      let depth = 0
      const lines = body
        .replace(/>\s*</g, '>\n<')
        .split('\n')
        .filter((l) => l.trim())

      const formatted = lines
        .map((line) => {
          const trimmed = line.trim()
          // Closing tag or self-closing: decrease before indent
          if (trimmed.startsWith('</')) depth = Math.max(0, depth - 1)
          const indented = '  '.repeat(depth) + trimmed
          // Opening tag (not self-closing, not closing): increase after indent
          if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<?') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
            depth++
          }
          return indented
        })
        .join('\n')

      onbodychange(formatted)
      formatFeedback = 'Formatted'
      setTimeout(() => formatFeedback = '', 1500)
    } catch {
      formatFeedback = 'Format error'
      setTimeout(() => formatFeedback = '', 2000)
    }
  }

  const typeLabels: Record<string, string> = {
    none: 'None',
    json: 'JSON',
    xml: 'XML',
    'form-data': 'Form Data',
    urlencoded: 'URL Encoded',
    raw: 'Raw',
    graphql: 'GraphQL',
  }

  function addFormEntry(): void {
    onformdatachange([...formData, { key: '', value: '', type: 'text', enabled: true }])
  }

  function removeFormEntry(index: number): void {
    onformdatachange(formData.filter((_, i) => i !== index))
  }

  function updateFormEntry(index: number, field: string, value: string | boolean): void {
    onformdatachange(
      formData.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    )
  }

  async function pickFile(index: number): Promise<void> {
    const result = await window.api.proxy.pickFile()
    if (result) {
      onformdatachange(
        formData.map((e, i) =>
          i === index ? { ...e, value: result.name, filePath: result.path, fileName: result.name } : e
        )
      )
    }
  }

  // Convert body to URL-encoded key-value entries for the KeyValueEditor.
  // Body is stored as a JSON array of KeyValueEntry (same as form-data).
  let urlencodedEntries = $derived.by(() => {
    if (bodyType !== 'urlencoded') return []
    if (!body) return [{ key: '', value: '', enabled: true }]
    // Try JSON array first (supports enabled/disabled state)
    try {
      const parsed = JSON.parse(body)
      if (Array.isArray(parsed)) return parsed as KeyValueEntry[]
    } catch { /* not JSON — try legacy URLSearchParams format */ }
    try {
      const params = new URLSearchParams(body)
      const entries: KeyValueEntry[] = []
      params.forEach((value, key) => {
        entries.push({ key, value, enabled: true })
      })
      if (entries.length === 0) entries.push({ key: '', value: '', enabled: true })
      return entries
    } catch {
      return [{ key: '', value: '', enabled: true }]
    }
  })

  function handleUrlencodedChange(entries: KeyValueEntry[]): void {
    onbodychange(JSON.stringify(entries))
  }
</script>

<div class="flex flex-col h-full">
  <!-- Type selector -->
  <div class="flex items-center gap-0.5 shrink-0 px-2.5 py-1.5 border-b border-[var(--glass-border)]">
    {#each BODY_TYPES as type (type)}
      <button
        onclick={() => onbodytypechange(type)}
        class="px-2 py-1 border-none rounded bg-transparent text-[11px] cursor-pointer transition-[color,background] duration-[0.12s]
          {bodyType === type
            ? 'text-brand-400 bg-brand-500/[0.12] font-medium hover:bg-brand-500/[0.15]'
            : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/40'}"
      >
        {typeLabels[type]}
      </button>
    {/each}

    {#if bodyType === 'json' || bodyType === 'xml'}
      <span class="flex-1"></span>
      <button
        onclick={bodyType === 'json' ? formatJson : formatXml}
        class="flex items-center gap-1 px-2 py-1 border-none rounded bg-transparent text-surface-400 text-[11px] cursor-pointer transition-[color,background] duration-[0.12s] whitespace-nowrap hover:text-surface-200 hover:bg-surface-700/40"
        title="Pretty print"
      >
        {#if formatFeedback}
          <span class="text-[11px] {formatFeedback !== 'Formatted' ? 'text-status-client-error' : 'text-success'}">
            {formatFeedback}
          </span>
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h6M4 12h16M4 17h10"/>
          </svg>
          Format
        {/if}
      </button>
    {/if}
  </div>

  <!-- Body content -->
  <div class="flex-1 overflow-auto">
    {#if bodyType === 'none'}
      <div class="flex h-full items-center justify-center">
        <p class="text-xs text-surface-500">This request does not have a body.</p>
      </div>
    {:else if bodyType === 'json'}
      <div class="h-full p-2">
        <CodeEditor value={body} language="json" placeholder={'{"key": "value"}'} onchange={onbodychange} enableVariableHighlight={!!getResolvedVars} getResolvedVariables={getResolvedVars} />
      </div>
    {:else if bodyType === 'xml'}
      <div class="h-full p-2">
        <CodeEditor value={body} language="xml" placeholder="<root></root>" onchange={onbodychange} enableVariableHighlight={!!getResolvedVars} getResolvedVariables={getResolvedVars} />
      </div>
    {:else if bodyType === 'raw'}
      <div class="h-full p-2">
        <CodeEditor value={body} language="text" placeholder="Raw body..." onchange={onbodychange} enableVariableHighlight={!!getResolvedVars} getResolvedVariables={getResolvedVars} />
      </div>
    {:else if bodyType === 'graphql'}
      <div class="flex flex-col h-full" bind:this={gqlSplitContainer}>
        <!-- Query pane -->
        <div class="flex flex-col p-2 min-h-0" style="flex: {gqlSplitPercent} 0 0%">
          <div class="flex items-center mb-1 shrink-0 gap-1.5">
            <div class="text-[10px] font-medium uppercase tracking-[0.06em] text-surface-500">Query</div>
            <span class="flex-1"></span>
            {#if schemaError}
              <span class="text-[10px] text-status-client-error truncate max-w-48" title={schemaError}>Schema error</span>
            {:else if graphqlSchema}
              <span class="text-[10px] text-success">Schema loaded</span>
            {/if}
            {#if onfetchschema}
              <button
                onclick={onfetchschema}
                disabled={schemaLoading}
                class="flex items-center gap-1 px-1.5 py-0.5 border-none rounded bg-transparent text-surface-400 text-[10px] cursor-pointer transition-[color,background] duration-[0.12s] whitespace-nowrap hover:text-surface-200 hover:bg-surface-700/40 disabled:opacity-40 disabled:cursor-default"
                title={graphqlSchema ? 'Refresh schema' : 'Fetch schema from endpoint for autocomplete'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:gql-spin={schemaLoading}>
                  <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.6"/><path d="M21 3v6h-6"/>
                </svg>
                {schemaLoading ? 'Loading...' : graphqlSchema ? 'Refresh' : 'Schema'}
              </button>
            {/if}
          </div>
          <div class="flex-1 min-h-0">
            <CodeEditor value={gqlParsed.query} language="graphql" {graphqlSchema} placeholder={"query { ... }"} onchange={handleGraphqlQueryChange} enableVariableHighlight={!!getResolvedVars} getResolvedVariables={getResolvedVars} />
          </div>
        </div>

        <!-- Draggable divider -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="gql-divider"
          class:gql-split--dragging={gqlDragging}
          onpointerdown={onGqlDividerPointerDown}
          onpointermove={onGqlDividerPointerMove}
          onpointerup={onGqlDividerPointerUp}
          onpointercancel={onGqlDividerPointerCancel}
        ></div>

        <!-- Variables pane -->
        <div class="flex flex-col p-2 min-h-0" style="flex: {100 - gqlSplitPercent} 0 0%">
          <div class="text-[10px] font-medium uppercase tracking-[0.06em] text-surface-500 mb-1 shrink-0">Variables</div>
          <div class="flex-1 min-h-0">
            <CodeEditor value={gqlParsed.variables} language="json" placeholder={'{"key": "value"}'} onchange={handleGraphqlVarsChange} />
          </div>
        </div>
      </div>
    {:else if bodyType === 'urlencoded'}
      <div class="p-3">
        <KeyValueEditor entries={urlencodedEntries} onchange={handleUrlencodedChange} />
      </div>
    {:else if bodyType === 'form-data'}
      <div class="flex flex-col">
        <!-- Header -->
        <div class="flex items-center h-7 px-0.5 border-b border-[var(--glass-border)] gap-px">
          {#if formDataBulkMode}
            <span class="flex-1 min-w-0 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-surface-500 font-mono" style="font-feature-settings: var(--font-feature-mono)">Bulk Edit</span>
          {:else}
            <span class="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-surface-500 font-mono" style="font-feature-settings: var(--font-feature-mono)"></span>
            <span class="flex-1 min-w-0 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-surface-500 font-mono" style="font-feature-settings: var(--font-feature-mono)">Key</span>
            <span class="w-9 shrink-0 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-surface-500 font-mono" style="font-feature-settings: var(--font-feature-mono)">Type</span>
            <span class="flex-1 min-w-0 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-surface-500 font-mono" style="font-feature-settings: var(--font-feature-mono)">Value</span>
          {/if}
          <button
            onclick={() => formDataBulkMode ? exitFormDataBulkMode() : enterFormDataBulkMode()}
            class="ml-auto flex shrink-0 items-center gap-1 rounded border-none px-1.5 py-0.5 text-[10px] cursor-pointer transition-[color,background] duration-[0.12s]
              {formDataBulkMode
                ? 'bg-brand-500/15 text-brand-400'
                : 'bg-transparent text-surface-500 hover:text-surface-200 hover:bg-surface-700/40'}"
            title={formDataBulkMode ? 'Switch to row editor' : 'Switch to bulk editor'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 6h16M4 12h16M4 18h10"/>
            </svg>
            Bulk Edit
          </button>
          {#if !formDataBulkMode}<span class="w-[30px] shrink-0"></span>{/if}
        </div>

        {#if formDataBulkMode}
          <textarea
            class="fd-bulk-textarea"
            value={formDataBulkText}
            oninput={handleFormDataBulkInput}
            placeholder="key:value"
            spellcheck={false}
          ></textarea>
        {:else}
          {#each formData as entry, i (i)}
            <div class="group flex items-center gap-px px-0.5 border-b border-[var(--border-subtle)] transition-[background] duration-100 hover:bg-surface-700/20" class:fd-row--disabled={!entry.enabled}>
              <span class="flex items-center w-9 shrink-0 justify-center">
                <Checkbox checked={entry.enabled} onchange={(v) => updateFormEntry(i, 'enabled', v)} />
              </span>
              <span class="fd-cell--key flex items-center flex-1 min-w-0">
                <VarInput
                  value={entry.key}
                  oninput={(value) => updateFormEntry(i, 'key', value)}
                  placeholder="Key"
                  class="fd-input"
                />
              </span>
              <span class="flex items-center w-9 shrink-0 justify-center">
                <button
                  class="flex items-center justify-center w-6 h-6 border-none rounded bg-transparent text-surface-500 cursor-pointer transition-[color,background] duration-[0.12s] hover:text-surface-200 hover:bg-surface-700/40"
                  title={entry.type === 'text' ? 'Switch to file' : 'Switch to text'}
                  onclick={() => updateFormEntry(i, 'type', entry.type === 'text' ? 'file' : 'text')}
                >
                  {#if entry.type === 'file'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                    </svg>
                  {:else}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M8 20h8"/>
                    </svg>
                  {/if}
                </button>
              </span>
              <span class="flex items-center flex-1 min-w-0">
                {#if entry.type === 'file'}
                  <button onclick={() => pickFile(i)} class="fd-file w-full min-w-0 h-8 flex items-center gap-[5px] px-2 border-0 border-l border-solid border-surface-700/50 bg-transparent text-surface-400 text-xs cursor-pointer text-left whitespace-nowrap overflow-hidden text-ellipsis transition-[color] duration-[0.12s] hover:text-brand-400">
                    {#if entry.value}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                      </svg>
                      {entry.value}
                    {:else}
                      Choose file...
                    {/if}
                  </button>
                {:else}
                  <VarInput
                    value={entry.value}
                    oninput={(value) => updateFormEntry(i, 'value', value)}
                    placeholder="Value"
                    class="fd-input"
                  />
                {/if}
              </span>
              <span class="flex items-center w-[30px] shrink-0 justify-center">
                <button onclick={() => removeFormEntry(i)} aria-label="Remove field" class="flex items-center justify-center w-6 h-6 shrink-0 border-none rounded bg-transparent text-surface-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-[opacity,color,background] duration-100 hover:text-danger-light hover:bg-danger-light/[0.08]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          {/each}

          <button onclick={addFormEntry} class="flex items-center gap-[5px] py-1.5 px-2 ml-9 border-none bg-transparent text-surface-500 text-[11px] cursor-pointer transition-[color] duration-[0.12s] hover:text-brand-400">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Add field
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* --- Form Data: global selectors for VarInput internals --- */
  .fd-row--disabled :global(.fd-input),
  .fd-row--disabled .fd-file {
    opacity: 0.35;
  }

  .fd-cell--key :global(.fd-input) {
    font-weight: 500;
    border-left: none;
  }

  :global(.fd-input) {
    width: 100%;
    height: 32px;
    line-height: 32px;
    min-width: 0;
    padding: 0 8px;
    border: none;
    border-left: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    transition: background 0.12s;
  }

  :global(.fd-input:focus) {
    background: color-mix(in srgb, var(--color-brand-500) 5%, transparent);
  }

  .fd-bulk-textarea {
    width: 100%;
    min-height: 120px;
    padding: 8px;
    border: none;
    background: transparent;
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    font-family: var(--font-mono, monospace);
    font-feature-settings: var(--font-feature-mono);
    line-height: 1.6;
    outline: none;
    resize: vertical;
  }

  .fd-bulk-textarea::placeholder {
    color: var(--color-surface-600);
  }

  .fd-bulk-textarea:focus {
    background: color-mix(in srgb, var(--color-brand-500) 3%, transparent);
  }

  .gql-spin {
    animation: gql-spin 0.8s linear infinite;
  }

  @keyframes gql-spin {
    to { transform: rotate(360deg); }
  }

  /* --- GraphQL query/variables draggable divider --- */
  .gql-divider {
    position: relative;
    height: 1px;
    flex-shrink: 0;
    background: var(--glass-border);
    cursor: row-resize;
    z-index: 2;
    touch-action: none;
  }

  /* Centre pill indicator */
  .gql-divider::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 28px;
    height: 3px;
    border-radius: 2px;
    background: var(--color-surface-600);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
  }

  /* Larger hit area */
  .gql-divider::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -4px;
    bottom: -4px;
  }

  .gql-divider:hover::before,
  .gql-split--dragging::before {
    opacity: 1;
  }

  .gql-split--dragging {
    height: 3px;
    background: var(--color-brand-500);
  }

  .gql-split--dragging::before {
    background: var(--color-brand-400);
    opacity: 1;
  }

</style>
