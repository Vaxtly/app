<script lang="ts">
  import { appStore } from '../../lib/stores/app.svelte'
  import { collectionsStore } from '../../lib/stores/collections.svelte'
  import { environmentsStore } from '../../lib/stores/environments.svelte'
  import { mcpStore } from '../../lib/stores/mcp.svelte'

  type ExportType = 'all' | 'collections' | 'environments' | 'mcp_servers' | 'config'

  let exportType = $state<ExportType>('all')
  let exporting = $state(false)
  let importing = $state(false)
  let dragOver = $state(false)
  let importStage = $state<'idle' | 'reading' | 'detecting' | 'importing' | 'done'>('idle')
  let selectedFile = $state<{ name: string; size: number; format: string | null } | null>(null)
  let status = $state<{ type: 'success' | 'error'; message: string } | null>(null)

  const exportOptions: { key: ExportType; label: string; desc: string }[] = [
    { key: 'all', label: 'Everything', desc: 'Collections, environments, MCP servers, and settings' },
    { key: 'collections', label: 'Collections', desc: 'Requests, folders, and variables' },
    { key: 'environments', label: 'Environments', desc: 'Variables and secrets' },
    { key: 'mcp_servers', label: 'MCP Servers', desc: 'Server configs and transport settings' },
    { key: 'config', label: 'Config', desc: 'App preferences only' },
  ]

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function detectFormatLabel(parsed: Record<string, unknown>): string {
    if (isOpenAPIFormat(parsed)) return 'OpenAPI Specification'
    if (isInsomniaFormat(parsed)) return 'Insomnia Export'
    if (parsed.version && Array.isArray(parsed.collections)) return 'Postman Dump'
    const info = parsed.info
    if (info && typeof info === 'object') {
      if ('_postman_id' in (info as object) || 'schema' in (info as object)) return 'Postman Collection v2.1'
    }
    if (parsed._postman_variable_scope === 'environment') return 'Postman Environment'
    if (Array.isArray(parsed.values) && typeof parsed.name === 'string') return 'Postman Environment'
    if (parsed.vaxtly_export) return 'Vaxtly Export'
    return 'Vaxtly Export'
  }

  function isOpenAPIFormat(parsed: Record<string, unknown>): boolean {
    return (typeof parsed.openapi === 'string' || typeof parsed.swagger === 'string') &&
      typeof parsed.info === 'object' && parsed.info !== null
  }

  function isInsomniaFormat(parsed: Record<string, unknown>): boolean {
    return parsed._type === 'export' && typeof parsed.__export_format === 'number'
  }

  function isPostmanFormat(parsed: Record<string, unknown>): boolean {
    if (parsed.version && Array.isArray(parsed.collections)) return true
    const info = parsed.info
    if (info && typeof info === 'object') {
      if ('_postman_id' in (info as object) || 'schema' in (info as object)) return true
    }
    if (parsed._postman_variable_scope === 'environment') return true
    if (Array.isArray(parsed.values) && typeof parsed.name === 'string') return true
    return false
  }

  async function handleExport(): Promise<void> {
    exporting = true
    status = null
    try {
      const data = await window.api.data.export(exportType, appStore.activeWorkspaceId ?? undefined)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vaxtly-export-${exportType}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      status = { type: 'success', message: 'Export saved successfully' }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Export failed' }
    } finally {
      exporting = false
    }
  }

  async function processImport(input: string, fileName: string, fileSize: number): Promise<void> {
    importing = true
    importStage = 'detecting'
    status = null

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(input)
    } catch {
      // Not JSON — try YAML (for OpenAPI YAML files)
      try {
        const yamlParsed = (await import('js-yaml')).default.load(input)
        if (yamlParsed && typeof yamlParsed === 'object' && !Array.isArray(yamlParsed)) {
          parsed = yamlParsed as Record<string, unknown>
        } else {
          status = { type: 'error', message: 'Invalid file — could not parse as JSON or YAML' }
          importing = false
          importStage = 'idle'
          selectedFile = null
          return
        }
      } catch {
        status = { type: 'error', message: 'Invalid file — could not parse as JSON or YAML' }
        importing = false
        importStage = 'idle'
        selectedFile = null
        return
      }
    }

    const format = detectFormatLabel(parsed)
    selectedFile = { name: fileName, size: fileSize, format }

    importStage = 'importing'

    try {
      if (isOpenAPIFormat(parsed)) {
        const result = await window.api.data.importOpenAPI(input, appStore.activeWorkspaceId ?? undefined)
        const parts: string[] = []
        if (result.collections > 0) parts.push(`${result.collections} collection${result.collections > 1 ? 's' : ''}`)
        if (result.requests > 0) parts.push(`${result.requests} request${result.requests > 1 ? 's' : ''}`)
        if (result.folders > 0) parts.push(`${result.folders} folder${result.folders > 1 ? 's' : ''}`)
        const summary = parts.length > 0 ? parts.join(', ') : 'nothing'
        status = {
          type: result.errors.length > 0 ? 'error' : 'success',
          message: `Imported ${summary}${result.errors.length > 0 ? `. Errors: ${result.errors.join(', ')}` : ''}`,
        }
      } else if (isInsomniaFormat(parsed)) {
        const result = await window.api.data.importInsomnia(input, appStore.activeWorkspaceId ?? undefined)
        const parts: string[] = []
        if (result.collections > 0) parts.push(`${result.collections} collection${result.collections > 1 ? 's' : ''}`)
        if (result.requests > 0) parts.push(`${result.requests} request${result.requests > 1 ? 's' : ''}`)
        if (result.folders > 0) parts.push(`${result.folders} folder${result.folders > 1 ? 's' : ''}`)
        if (result.environments > 0) parts.push(`${result.environments} environment${result.environments > 1 ? 's' : ''}`)
        const summary = parts.length > 0 ? parts.join(', ') : 'nothing'
        status = {
          type: result.errors.length > 0 ? 'error' : 'success',
          message: `Imported ${summary}${result.errors.length > 0 ? `. Errors: ${result.errors.join(', ')}` : ''}`,
        }
      } else if (isPostmanFormat(parsed)) {
        const result = await window.api.data.importPostman(input, appStore.activeWorkspaceId ?? undefined)
        const parts: string[] = []
        if (result.collections > 0) parts.push(`${result.collections} collection${result.collections > 1 ? 's' : ''}`)
        if (result.requests > 0) parts.push(`${result.requests} request${result.requests > 1 ? 's' : ''}`)
        if (result.folders > 0) parts.push(`${result.folders} folder${result.folders > 1 ? 's' : ''}`)
        if (result.environments > 0) parts.push(`${result.environments} environment${result.environments > 1 ? 's' : ''}`)
        const summary = parts.length > 0 ? parts.join(', ') : 'nothing'
        status = {
          type: result.errors.length > 0 ? 'error' : 'success',
          message: `Imported ${summary}${result.errors.length > 0 ? `. Errors: ${result.errors.join(', ')}` : ''}`,
        }
      } else {
        const result = await window.api.data.import(input, appStore.activeWorkspaceId ?? undefined)
        const parts: string[] = []
        if (result.collections > 0) parts.push(`${result.collections} collection${result.collections > 1 ? 's' : ''}`)
        if (result.environments > 0) parts.push(`${result.environments} environment${result.environments > 1 ? 's' : ''}`)
        if (result.mcp_servers > 0) parts.push(`${result.mcp_servers} MCP server${result.mcp_servers > 1 ? 's' : ''}`)
        if (result.config) parts.push('config')
        const summary = parts.length > 0 ? parts.join(', ') : 'nothing'
        status = {
          type: result.errors.length > 0 ? 'error' : 'success',
          message: `Imported ${summary}${result.errors.length > 0 ? `. Errors: ${result.errors.join(', ')}` : ''}`,
        }
      }

      await collectionsStore.loadAll(appStore.activeWorkspaceId ?? undefined)
      await environmentsStore.loadAll(appStore.activeWorkspaceId ?? undefined)
      if (appStore.activeWorkspaceId) {
        await mcpStore.loadServers(appStore.activeWorkspaceId)
      }
    } catch (err) {
      status = { type: 'error', message: err instanceof Error ? err.message : 'Import failed' }
    } finally {
      importStage = 'done'
      importing = false
      // Clear file state after a delay so the user sees the result
      setTimeout(() => {
        if (!importing) {
          selectedFile = null
          importStage = 'idle'
        }
      }, 4000)
    }
  }

  async function handleFilePick(): Promise<void> {
    if (importing) return
    importStage = 'reading'

    const result = await window.api.data.pickAndRead()
    if (!result) {
      importStage = 'idle'
      return
    }

    await processImport(result.content, result.name, result.content.length)
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    dragOver = true
  }

  function handleDragLeave(e: DragEvent): void {
    // Only count if leaving the drop zone itself, not entering a child
    const related = e.relatedTarget as Node | null
    const target = e.currentTarget as HTMLElement
    if (related && target.contains(related)) return
    dragOver = false
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragOver = false
    if (importing) return

    const file = e.dataTransfer?.files[0]
    if (!file) return
    if (!file.name.match(/\.(json|yaml|yml)$/i)) {
      status = { type: 'error', message: 'Only JSON and YAML files are supported' }
      return
    }

    importStage = 'reading'
    const text = await file.text()
    await processImport(text, file.name, file.size)
  }

  function clearStatus(): void {
    status = null
  }
</script>

<div class="data-tab">
  <!-- Status toast -->
  {#if status}
    <button class="status-banner" class:is-success={status.type === 'success'} class:is-error={status.type === 'error'} onclick={clearStatus}>
      <div class="status-icon">
        {#if status.type === 'success'}
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 5V8.5M8 11H8.005" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        {/if}
      </div>
      <span class="status-text">{status.message}</span>
      <svg class="status-dismiss" viewBox="0 0 12 12" fill="none">
        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </button>
  {/if}

  <!-- Export section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon export-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <path d="M9 2.5V11M9 2.5L5.5 6M9 2.5L12.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 11V13.5C3 14.328 3.672 15 4.5 15H13.5C14.328 15 15 14.328 15 13.5V11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="section-title">Export</div>
        <div class="section-subtitle">Download workspace data as JSON</div>
      </div>
    </div>

    <div class="export-grid">
      {#each exportOptions as opt}
        <button
          class="export-option"
          class:is-active={exportType === opt.key}
          onclick={() => { exportType = opt.key }}
        >
          <span class="export-option-label">{opt.label}</span>
          <span class="export-option-desc">{opt.desc}</span>
        </button>
      {/each}
    </div>

    <button
      class="action-btn primary"
      onclick={handleExport}
      disabled={exporting}
    >
      {#if exporting}
        <span class="spinner"></span>
        Exporting...
      {:else}
        <svg viewBox="0 0 16 16" fill="none" class="btn-icon">
          <path d="M2 10V12.5C2 13.328 2.672 14 3.5 14H12.5C13.328 14 14 13.328 14 12.5V10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Export {exportOptions.find(o => o.key === exportType)?.label}
      {/if}
    </button>
  </section>

  <div class="divider"></div>

  <!-- Import section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon import-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <path d="M9 15.5V7M9 15.5L5.5 12M9 15.5L12.5 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 7V4.5C3 3.672 3.672 3 4.5 3H13.5C14.328 3 15 3.672 15 4.5V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="section-title">Import</div>
        <div class="section-subtitle">Vaxtly exports, Postman collections, Insomnia exports, and environments</div>
      </div>
    </div>

    <!-- Drop zone -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drop-zone"
      class:is-dragover={dragOver}
      class:is-importing={importing}
      class:is-done={importStage === 'done'}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    >
      {#if importStage === 'idle'}
        <div class="drop-zone-content">
          <div class="drop-zone-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 17V11L7 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11L11 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 10V15C22 20 20 22 15 22H9C4 22 2 20 2 15V9C2 4 4 2 9 2H14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 10H18C15 10 14 9 14 6V2L22 10Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="drop-zone-text">
            <span class="drop-zone-primary">Drop a JSON file here</span>
            <span class="drop-zone-secondary">or</span>
          </div>
          <button class="action-btn secondary compact" onclick={handleFilePick}>
            Browse files
          </button>
        </div>
      {:else if importStage === 'reading' || importStage === 'detecting'}
        <div class="drop-zone-content">
          <span class="spinner lg"></span>
          <span class="stage-label">Reading file...</span>
        </div>
      {:else if importStage === 'importing'}
        <div class="drop-zone-content">
          <span class="spinner lg"></span>
          {#if selectedFile}
            <div class="file-info">
              <span class="file-name">{selectedFile.name}</span>
              <span class="file-meta">{formatBytes(selectedFile.size)} &middot; {selectedFile.format}</span>
            </div>
          {/if}
          <span class="stage-label">Importing...</span>
        </div>
      {:else if importStage === 'done'}
        <div class="drop-zone-content">
          {#if status?.type === 'success'}
            <div class="done-icon success">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          {:else}
            <div class="done-icon error">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
          {/if}
          {#if selectedFile}
            <div class="file-info">
              <span class="file-name">{selectedFile.name}</span>
              <span class="file-meta">{formatBytes(selectedFile.size)} &middot; {selectedFile.format}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Format hint -->
    <div class="format-hint">
      <svg viewBox="0 0 14 14" fill="none" class="hint-icon">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1"/>
        <path d="M7 6.5V9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <circle cx="7" cy="4.8" r="0.6" fill="currentColor"/>
      </svg>
      <span>Format is auto-detected. OpenAPI 3.x (JSON/YAML), Postman v2.1 collections, workspace dumps, environment files, and Insomnia v4 exports are all supported.</span>
    </div>
  </section>
</div>

<style>
  .data-tab {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Status banner */
  .status-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid;
    font-size: calc(12px + var(--ui-bump));
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
    transition: opacity 0.15s;
    animation: slideIn 0.2s ease-out;
  }
  .status-banner:hover {
    opacity: 0.85;
  }
  .status-banner.is-success {
    border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    color: var(--color-banner-success);
  }
  .status-banner.is-error {
    border-color: color-mix(in srgb, var(--color-danger-light) 25%, transparent);
    background: color-mix(in srgb, var(--color-danger-light) 8%, transparent);
    color: var(--color-banner-error);
  }
  .status-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }
  .status-icon svg {
    width: 16px;
    height: 16px;
  }
  .status-text {
    flex: 1;
    min-width: 0;
  }
  .status-dismiss {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    opacity: 0.4;
  }
  .status-banner:hover .status-dismiss {
    opacity: 0.8;
  }

  /* Section layout */
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .section-icon svg {
    width: 16px;
    height: 16px;
  }
  .export-icon {
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-400);
  }
  .import-icon {
    background: color-mix(in srgb, var(--color-purple) 15%, transparent);
    color: var(--color-purple);
  }
  .section-title {
    font-size: calc(13px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
    line-height: 1.2;
  }
  .section-subtitle {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.3;
  }

  /* Export option grid */
  .export-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .export-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .export-option:hover {
    border-color: var(--glass-border);
    background: var(--tint-subtle);
  }
  .export-option.is-active {
    border-color: color-mix(in srgb, var(--color-brand-500) 50%, transparent);
    background: color-mix(in srgb, var(--color-brand-500) 8%, transparent);
  }
  .export-option-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
  }
  .export-option.is-active .export-option-label {
    color: var(--color-brand-300);
  }
  .export-option-desc {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.3;
  }

  /* Divider */
  .divider {
    height: 1px;
    background: var(--glass-border);
  }

  /* Drop zone */
  .drop-zone {
    border: 1.5px dashed var(--color-surface-600);
    border-radius: 10px;
    padding: 20px;
    transition: all 0.2s ease;
    background: transparent;
    position: relative;
    overflow: hidden;
  }
  .drop-zone.is-dragover {
    border-color: var(--color-brand-400);
    border-style: solid;
    background: color-mix(in srgb, var(--color-brand-500) 6%, transparent);
  }
  .drop-zone.is-importing {
    border-color: var(--color-surface-600);
    border-style: solid;
  }
  .drop-zone.is-done {
    border-style: solid;
  }
  .drop-zone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .drop-zone-icon {
    width: 28px;
    height: 28px;
    color: var(--color-surface-500);
    opacity: 0.7;
  }
  .drop-zone-icon svg {
    width: 28px;
    height: 28px;
  }
  .is-dragover .drop-zone-icon {
    color: var(--color-brand-400);
    opacity: 1;
  }
  .drop-zone-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .drop-zone-primary {
    font-size: calc(12px + var(--ui-bump));
    color: var(--color-surface-300);
    font-weight: 500;
  }
  .drop-zone-secondary {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-600);
  }

  /* File info */
  .file-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .file-name {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-meta {
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
  }

  /* Stage label */
  .stage-label {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-400);
  }

  /* Done icons */
  .done-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .done-icon svg {
    width: 18px;
    height: 18px;
  }
  .done-icon.success {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success);
  }
  .done-icon.error {
    background: color-mix(in srgb, var(--color-danger-light) 15%, transparent);
    color: var(--color-danger-light);
  }

  /* Buttons */
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
    border: none;
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .action-btn.primary {
    background: var(--color-brand-600);
    color: white;
  }
  .action-btn.primary:not(:disabled):hover {
    background: var(--color-brand-500);
  }
  .action-btn.secondary {
    background: transparent;
    border: 1px solid var(--glass-border);
    color: var(--color-surface-300);
  }
  .action-btn.secondary:not(:disabled):hover {
    background: var(--tint-active);
    border-color: var(--border-default);
    color: var(--color-surface-200);
  }
  .action-btn.compact {
    padding: 4px 12px;
    font-size: calc(11px + var(--ui-bump));
  }
  .btn-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  .spinner.lg {
    width: 20px;
    height: 20px;
    border-width: 2px;
    color: var(--color-brand-400);
  }

  /* Format hint */
  .format-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: calc(10px + var(--ui-bump));
    color: var(--color-surface-500);
    line-height: 1.4;
    padding: 0 2px;
  }
  .hint-icon {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    margin-top: 0.5px;
    opacity: 0.6;
  }

  /* Animations */
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
