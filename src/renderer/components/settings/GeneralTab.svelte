<script lang="ts">
  import { settingsStore } from '../../lib/stores/settings.svelte'
  import Toggle from '../shared/Toggle.svelte'

  let theme = $derived(settingsStore.get('app.theme'))
  let textSize = $derived(settingsStore.get('app.text_size'))
  let layout = $derived(settingsStore.get('request.layout'))
  let timeout = $derived(settingsStore.get('request.timeout'))
  let verifySsl = $derived(settingsStore.get('request.verify_ssl'))
  let followRedirects = $derived(settingsStore.get('request.follow_redirects'))
  let appVersion = $derived(settingsStore.get('app.version'))

  let updateStatus: 'idle' | 'checking' | 'available' | 'up-to-date' | 'error' = $state('idle')
  let availableVersion = $state('')

  async function handleCheckUpdates(): Promise<void> {
    updateStatus = 'checking'
    const cleanups = [
      window.api.on.updateAvailable((data) => {
        updateStatus = 'available'
        availableVersion = data.version
        dispose()
      }),
      window.api.on.updateNotAvailable(() => {
        updateStatus = 'up-to-date'
        dispose()
      }),
      window.api.on.updateError(() => {
        updateStatus = 'error'
        dispose()
      }),
    ]
    function dispose(): void {
      cleanups.forEach((fn) => fn())
    }

    // Safety timeout in case no event fires at all
    const timer = setTimeout(() => {
      if (updateStatus === 'checking') {
        updateStatus = 'up-to-date'
        dispose()
      }
    }, 15000)
    cleanups.push(() => clearTimeout(timer))

    await window.api.updater.check()
  }

  function handleThemeChange(value: 'dark' | 'light' | 'system'): void {
    settingsStore.set('app.theme', value)
  }

  function handleTextSizeChange(value: 'sm' | 'md' | 'lg'): void {
    settingsStore.set('app.text_size', value)
  }

  function handleLayoutChange(value: 'rows' | 'columns'): void {
    settingsStore.set('request.layout', value)
  }

  function handleTimeoutChange(e: Event): void {
    const value = Math.max(1, Math.min(300, Number((e.target as HTMLInputElement).value) || 30))
    settingsStore.set('request.timeout', value)
  }

  function toggleSsl(value: boolean): void {
    settingsStore.set('request.verify_ssl', value)
  }

  function toggleRedirects(value: boolean): void {
    settingsStore.set('request.follow_redirects', value)
  }

  // Certificate settings
  let caCertPath = $derived(settingsStore.get('tls.ca_cert_path'))
  let clientCertPath = $derived(settingsStore.get('tls.client_cert_path'))
  let clientKeyPath = $derived(settingsStore.get('tls.client_key_path'))
  let clientKeyPassphrase = $derived(settingsStore.get('tls.client_key_passphrase'))
  let hasCerts = $derived(caCertPath || clientCertPath || clientKeyPath || clientKeyPassphrase)
  let certsExpanded = $state(false)
  let certsVisible = $derived(certsExpanded || hasCerts)

  function basename(path: string): string {
    return path.split(/[\\/]/).pop() ?? path
  }

  async function browseCert(key: 'tls.ca_cert_path' | 'tls.client_cert_path' | 'tls.client_key_path'): Promise<void> {
    const result = await window.api.proxy.pickCertFile()
    if (result) settingsStore.set(key, result.path)
  }

  function clearCert(key: 'tls.ca_cert_path' | 'tls.client_cert_path' | 'tls.client_key_path' | 'tls.client_key_passphrase'): void {
    settingsStore.set(key, '')
  }

  function clearAllCerts(): void {
    settingsStore.set('tls.ca_cert_path', '')
    settingsStore.set('tls.client_cert_path', '')
    settingsStore.set('tls.client_key_path', '')
    settingsStore.set('tls.client_key_passphrase', '')
  }

  function handlePassphraseChange(e: Event): void {
    settingsStore.set('tls.client_key_passphrase', (e.target as HTMLInputElement).value)
  }

  // Proxy settings
  let proxyUrl = $derived(settingsStore.get('proxy.url'))
  let proxyUsername = $derived(settingsStore.get('proxy.username'))
  let proxyPassword = $derived(settingsStore.get('proxy.password'))
  let proxyNoProxy = $derived(settingsStore.get('proxy.no_proxy'))
  let hasProxy = $derived(proxyUrl || proxyUsername || proxyPassword || proxyNoProxy)
  let proxyExpanded = $state(false)
  let proxyVisible = $derived(proxyExpanded || hasProxy)

  function handleProxyUrlChange(e: Event): void {
    settingsStore.set('proxy.url', (e.target as HTMLInputElement).value.trim())
  }

  function handleProxyUsernameChange(e: Event): void {
    settingsStore.set('proxy.username', (e.target as HTMLInputElement).value)
  }

  function handleProxyPasswordChange(e: Event): void {
    settingsStore.set('proxy.password', (e.target as HTMLInputElement).value)
  }

  function handleNoProxyChange(e: Event): void {
    settingsStore.set('proxy.no_proxy', (e.target as HTMLInputElement).value)
  }

  function clearAllProxy(): void {
    settingsStore.set('proxy.url', '')
    settingsStore.set('proxy.username', '')
    settingsStore.set('proxy.password', '')
    settingsStore.set('proxy.no_proxy', '')
  }
</script>

<div class="general-tab">
  <!-- Appearance section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon appearance-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M9 2.5V9L13 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="section-title">Appearance</div>
        <div class="section-subtitle">Color theme and text size for the interface</div>
      </div>
    </div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Theme</span>
        <span class="setting-desc">Choose light, dark, or follow your system</span>
      </div>
      <div class="theme-picker">
        <button
          class="theme-option"
          class:is-active={theme === 'light'}
          onclick={() => handleThemeChange('light')}
          title="Light"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="10" cy="10" r="3.5"/>
            <path d="M10 3V4.5M10 15.5V17M17 10H15.5M4.5 10H3M14.95 5.05L13.89 6.11M6.11 13.89L5.05 14.95M14.95 14.95L13.89 13.89M6.11 6.11L5.05 5.05"/>
          </svg>
        </button>
        <button
          class="theme-option"
          class:is-active={theme === 'dark'}
          onclick={() => handleThemeChange('dark')}
          title="Dark"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M17 11.36A7.5 7.5 0 118.64 3 5.5 5.5 0 0017 11.36z"/>
          </svg>
        </button>
        <button
          class="theme-option"
          class:is-active={theme === 'system'}
          onclick={() => handleThemeChange('system')}
          title="System"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="14" height="10" rx="1.5"/>
            <path d="M7 16h6M10 13v3"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="setting-row last">
      <div class="setting-info">
        <span class="setting-label">Text size</span>
        <span class="setting-desc">Adjusts the interface font scale</span>
      </div>
      <div class="text-size-picker">
        <button
          class="text-size-option text-size-option--sm"
          class:is-active={textSize === 'sm'}
          onclick={() => handleTextSizeChange('sm')}
          title="Small"
        >A</button>
        <button
          class="text-size-option text-size-option--md"
          class:is-active={textSize === 'md'}
          onclick={() => handleTextSizeChange('md')}
          title="Medium"
        >A</button>
        <button
          class="text-size-option text-size-option--lg"
          class:is-active={textSize === 'lg'}
          onclick={() => handleTextSizeChange('lg')}
          title="Large"
        >A</button>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- HTTP section -->
  <section class="section">
    <div class="section-header">
      <div class="section-icon http-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <path d="M3 9H15M15 9L11 5M15 9L11 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="section-title">Requests</div>
        <div class="section-subtitle">HTTP client behavior and defaults</div>
      </div>
    </div>

    <!-- Layout picker -->
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Layout</span>
        <span class="setting-desc">How request and response panels are arranged</span>
      </div>
      <div class="layout-picker">
        <button
          class="layout-option"
          class:is-active={layout === 'rows'}
          onclick={() => handleLayoutChange('rows')}
          title="Top / Bottom"
        >
          <svg viewBox="0 0 28 20" fill="none">
            <rect x="1" y="1" width="26" height="8" rx="1.5" stroke="currentColor" stroke-width="1"/>
            <rect x="1" y="11" width="26" height="8" rx="1.5" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button
          class="layout-option"
          class:is-active={layout === 'columns'}
          onclick={() => handleLayoutChange('columns')}
          title="Side by Side"
        >
          <svg viewBox="0 0 28 20" fill="none">
            <rect x="1" y="1" width="12" height="18" rx="1.5" stroke="currentColor" stroke-width="1"/>
            <rect x="15" y="1" width="12" height="18" rx="1.5" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Timeout -->
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Timeout</span>
        <span class="setting-desc">Maximum time to wait for a response</span>
      </div>
      <div class="timeout-input">
        <input
          type="number"
          value={timeout}
          onchange={handleTimeoutChange}
          min="1"
          max="300"
          class="num-input"
        />
        <span class="input-suffix">sec</span>
      </div>
    </div>

    <!-- Verify SSL -->
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Verify SSL</span>
        <span class="setting-desc">Reject invalid or self-signed certificates</span>
      </div>
      <Toggle checked={verifySsl} onchange={toggleSsl} />
    </div>

    <!-- Follow Redirects -->
    <div class="setting-row last">
      <div class="setting-info">
        <span class="setting-label">Follow Redirects</span>
        <span class="setting-desc">Automatically follow 3xx responses</span>
      </div>
      <Toggle checked={followRedirects} onchange={toggleRedirects} />
    </div>
  </section>

  <div class="divider"></div>

  <!-- Proxy section (collapsible) -->
  <section class="section">
    <button class="section-header section-header-btn" onclick={() => proxyExpanded = !proxyExpanded}>
      <div class="section-icon proxy-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M3 9H15M9 2.5C10.5 4.5 11.5 6.5 11.5 9S10.5 13.5 9 15.5M9 2.5C7.5 4.5 6.5 6.5 6.5 9S7.5 13.5 9 15.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="section-header-text">
        <div class="section-title">Proxy</div>
        <div class="section-subtitle">{hasProxy ? 'HTTP proxy configured' : 'Route requests through an HTTP proxy'}</div>
      </div>
      <svg class="section-chevron" class:is-open={proxyVisible} viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {#if proxyVisible}
      <!-- Proxy URL -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Proxy URL</span>
          <span class="setting-desc">HTTP or HTTPS proxy server address</span>
        </div>
        <input
          type="text"
          class="proxy-input"
          value={proxyUrl}
          onchange={handleProxyUrlChange}
          placeholder="http://proxy:8080"
        />
      </div>

      <!-- Username -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Username</span>
          <span class="setting-desc">Proxy authentication username</span>
        </div>
        <input
          type="text"
          class="proxy-input proxy-input-sm"
          value={proxyUsername}
          onchange={handleProxyUsernameChange}
          placeholder="None"
        />
      </div>

      <!-- Password -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Password</span>
          <span class="setting-desc">Proxy authentication password</span>
        </div>
        <input
          type="password"
          class="proxy-input proxy-input-sm"
          value={proxyPassword}
          onchange={handleProxyPasswordChange}
          placeholder="None"
        />
      </div>

      <!-- No Proxy -->
      <div class="setting-row" class:last={!hasProxy}>
        <div class="setting-info">
          <span class="setting-label">No Proxy</span>
          <span class="setting-desc">Hosts that bypass the proxy</span>
        </div>
        <input
          type="text"
          class="proxy-input"
          value={proxyNoProxy}
          onchange={handleNoProxyChange}
          placeholder="localhost, *.local"
        />
      </div>

      {#if hasProxy}
        <div class="setting-row last">
          <div></div>
          <button class="cert-clear-all-btn" onclick={clearAllProxy}>Clear proxy settings</button>
        </div>
      {/if}
    {/if}
  </section>

  <div class="divider"></div>

  <!-- Certificates section (collapsible) -->
  <section class="section">
    <button class="section-header section-header-btn" onclick={() => certsExpanded = !certsExpanded}>
      <div class="section-icon cert-icon">
        <svg viewBox="0 0 18 18" fill="none">
          <path d="M9 2L4 4.5V8.5C4 12 6.2 14.8 9 16C11.8 14.8 14 12 14 8.5V4.5L9 2Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 9L8.5 10.5L11 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="section-header-text">
        <div class="section-title">Certificates</div>
        <div class="section-subtitle">{hasCerts ? 'Custom CA and client certificates configured' : 'Custom CA and client certificates for mTLS'}</div>
      </div>
      <svg class="section-chevron" class:is-open={certsVisible} viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {#if certsVisible}
      <!-- CA Certificate -->
      <div class="setting-row" class:dimmed={!verifySsl}>
        <div class="setting-info">
          <span class="setting-label">CA Certificate</span>
          <span class="setting-desc">{#if !verifySsl}Only used when Verify SSL is on{:else}Trust a custom certificate authority{/if}</span>
        </div>
        <div class="cert-actions">
          {#if caCertPath}
            <span class="cert-filename" title={caCertPath}>{basename(caCertPath)}</span>
            <button class="cert-clear-btn" onclick={() => clearCert('tls.ca_cert_path')} title="Remove">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          {:else}
            <button class="cert-browse-btn" onclick={() => browseCert('tls.ca_cert_path')} disabled={!verifySsl}>Browse</button>
          {/if}
        </div>
      </div>

      <!-- Client Certificate -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Client Certificate</span>
          <span class="setting-desc">PEM certificate for mutual TLS</span>
        </div>
        <div class="cert-actions">
          {#if clientCertPath}
            <span class="cert-filename" title={clientCertPath}>{basename(clientCertPath)}</span>
            <button class="cert-clear-btn" onclick={() => clearCert('tls.client_cert_path')} title="Remove">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          {:else}
            <button class="cert-browse-btn" onclick={() => browseCert('tls.client_cert_path')}>Browse</button>
          {/if}
        </div>
      </div>

      <!-- Client Key -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Client Key</span>
          <span class="setting-desc">PEM private key for the client certificate</span>
        </div>
        <div class="cert-actions">
          {#if clientKeyPath}
            <span class="cert-filename" title={clientKeyPath}>{basename(clientKeyPath)}</span>
            <button class="cert-clear-btn" onclick={() => clearCert('tls.client_key_path')} title="Remove">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          {:else}
            <button class="cert-browse-btn" onclick={() => browseCert('tls.client_key_path')}>Browse</button>
          {/if}
        </div>
      </div>

      <!-- Key Passphrase -->
      <div class="setting-row" class:last={!hasCerts}>
        <div class="setting-info">
          <span class="setting-label">Key Passphrase</span>
          <span class="setting-desc">Optional passphrase for the private key</span>
        </div>
        <div class="cert-actions">
          <input
            type="password"
            class="passphrase-input"
            value={clientKeyPassphrase}
            onchange={handlePassphraseChange}
            placeholder="None"
          />
          {#if clientKeyPassphrase}
            <button class="cert-clear-btn" onclick={() => clearCert('tls.client_key_passphrase')} title="Clear">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          {/if}
        </div>
      </div>

      {#if hasCerts}
        <div class="setting-row last">
          <div></div>
          <button class="cert-clear-all-btn" onclick={clearAllCerts}>Clear all certificates</button>
        </div>
      {/if}
    {/if}
  </section>

  <div class="divider"></div>

  <!-- About -->
  <section class="about">
    <div class="about-card">
      <div class="about-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="about-info">
        <span class="about-name">Vaxtly</span>
        <span class="about-version">Version {appVersion}</span>
      </div>
      <div class="about-actions">
        {#if updateStatus === 'checking'}
          <span class="update-status">Checking…</span>
        {:else if updateStatus === 'available'}
          <span class="update-status update-found">v{availableVersion} available</span>
        {:else if updateStatus === 'up-to-date'}
          <span class="update-status update-ok">Up to date</span>
        {:else if updateStatus === 'error'}
          <span class="update-status update-err">Check failed</span>
        {:else}
          <button class="check-update-btn" onclick={handleCheckUpdates}>Check for updates</button>
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
  .general-tab {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Sections */
  .section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
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
  .appearance-icon {
    background: color-mix(in srgb, var(--color-purple) 15%, transparent);
    color: var(--color-purple);
  }
  .http-icon {
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-400);
  }
  .proxy-icon {
    background: color-mix(in srgb, var(--color-warning-muted) 15%, transparent);
    color: var(--color-warning-muted);
  }
  .cert-icon {
    background: color-mix(in srgb, var(--color-success-muted) 15%, transparent);
    color: var(--color-success-muted);
  }
  .section-header-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    width: 100%;
    cursor: pointer;
    border-radius: 8px;
    padding: 2px;
    margin: -2px -2px 8px;
    transition: background 0.12s ease;
  }
  .section-header-btn:hover {
    background: var(--tint-subtle);
  }
  .section-header-text {
    flex: 1;
    min-width: 0;
  }
  .section-chevron {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--color-surface-500);
    transform: rotate(-90deg);
    transition: transform 0.15s ease;
  }
  .section-chevron.is-open {
    transform: rotate(0deg);
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

  /* Setting rows */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-default);
  }
  .setting-row.last {
    border-bottom: none;
  }
  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .setting-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 500;
    color: var(--color-surface-200);
  }
  .setting-desc {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
  }

  /* Layout picker */
  .layout-picker {
    display: flex;
    gap: 4px;
  }
  .layout-option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-surface-500);
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .layout-option:hover {
    border-color: var(--glass-border);
    background: var(--tint-subtle);
    color: var(--color-surface-300);
  }
  .layout-option.is-active {
    border-color: color-mix(in srgb, var(--color-brand-500) 50%, transparent);
    background: color-mix(in srgb, var(--color-brand-500) 8%, transparent);
    color: var(--color-brand-400);
  }
  .layout-option svg {
    width: 24px;
    height: 18px;
  }

  /* Theme picker */
  .theme-picker {
    display: flex;
    gap: 4px;
  }
  .theme-option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-surface-500);
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .theme-option:hover {
    border-color: var(--glass-border);
    background: var(--tint-subtle);
    color: var(--color-surface-300);
  }
  .theme-option.is-active {
    border-color: color-mix(in srgb, var(--color-brand-500) 50%, transparent);
    background: color-mix(in srgb, var(--color-brand-500) 8%, transparent);
    color: var(--color-brand-400);
  }
  .theme-option svg {
    width: 16px;
    height: 16px;
  }

  /* Text size picker */
  .text-size-picker {
    display: flex;
    gap: 4px;
  }
  .text-size-option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-surface-500);
    font-family: var(--font-sans);
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .text-size-option:hover {
    border-color: var(--glass-border);
    background: var(--tint-subtle);
    color: var(--color-surface-300);
  }
  .text-size-option.is-active {
    border-color: color-mix(in srgb, var(--color-brand-500) 50%, transparent);
    background: color-mix(in srgb, var(--color-brand-500) 8%, transparent);
    color: var(--color-brand-400);
  }
  /* Pinned to fixed sizes so the picker is a stable reference, not affected by --ui-bump. */
  .text-size-option--sm { font-size: 11px; }
  .text-size-option--md { font-size: 14px; }
  .text-size-option--lg { font-size: 17px; }

  /* Inputs */
  .timeout-input {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .num-input {
    width: 56px;
    height: 28px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--tint-muted);
    color: var(--color-surface-100);
    font-size: calc(12px + var(--ui-bump));
    text-align: right;
    outline: none;
    transition: border-color 0.12s;
    -moz-appearance: textfield;
  }
  .num-input::-webkit-inner-spin-button,
  .num-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .num-input:focus {
    border-color: var(--color-brand-500);
  }
  .input-suffix {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
  }
  /* Certificates */
  .cert-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .cert-filename {
    font-size: calc(11px + var(--ui-bump));
    font-family: var(--font-mono, monospace);
    color: var(--color-surface-300);
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--tint-muted);
    border: 1px solid var(--border-subtle);
  }
  .cert-browse-btn {
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--tint-muted);
    color: var(--color-surface-300);
    font-size: calc(11px + var(--ui-bump));
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .cert-browse-btn:hover {
    border-color: var(--glass-border);
    background: var(--tint-active);
    color: var(--color-surface-200);
  }
  .cert-browse-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cert-clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--color-surface-500);
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .cert-clear-btn:hover {
    background: var(--tint-active);
    color: var(--color-danger-light);
  }
  .cert-clear-btn svg {
    width: 12px;
    height: 12px;
  }
  .cert-clear-all-btn {
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--color-danger-light) 30%, transparent);
    background: transparent;
    color: var(--color-danger-light);
    font-size: calc(11px + var(--ui-bump));
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .cert-clear-all-btn:hover {
    background: color-mix(in srgb, var(--color-danger-light) 10%, transparent);
  }
  .passphrase-input {
    width: 120px;
    height: 26px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--tint-muted);
    color: var(--color-surface-100);
    font-size: calc(11px + var(--ui-bump));
    outline: none;
    transition: border-color 0.12s;
  }
  .passphrase-input:focus {
    border-color: var(--color-brand-500);
  }
  .passphrase-input::placeholder {
    color: var(--color-surface-600);
  }
  .dimmed {
    opacity: 0.45;
  }
  /* Proxy */
  .proxy-input {
    width: 180px;
    height: 26px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--tint-muted);
    color: var(--color-surface-100);
    font-size: calc(11px + var(--ui-bump));
    outline: none;
    transition: border-color 0.12s;
  }
  .proxy-input:focus {
    border-color: var(--color-brand-500);
  }
  .proxy-input::placeholder {
    color: var(--color-surface-600);
  }
  .proxy-input-sm {
    width: 120px;
  }

  /* Divider */
  .divider {
    height: 1px;
    background: var(--glass-border);
  }

  /* About */
  .about-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--glass-border);
    background: var(--tint-subtle);
  }
  .about-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-brand-500) 15%, transparent);
    color: var(--color-brand-400);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .about-icon svg {
    width: 20px;
    height: 20px;
  }
  .about-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .about-name {
    font-size: calc(13px + var(--ui-bump));
    font-weight: 600;
    color: var(--color-surface-200);
  }
  .about-version {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-500);
  }
  .about-actions {
    margin-left: auto;
    flex-shrink: 0;
  }
  .check-update-btn {
    padding: 4px 12px;
    border-radius: 8px;
    border: 1px solid var(--glass-border);
    background: var(--tint-muted);
    color: var(--color-surface-200);
    font-size: calc(11px + var(--ui-bump));
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .check-update-btn:hover {
    border-color: var(--border-default);
    background: var(--tint-active);
  }
  .update-status {
    font-size: calc(11px + var(--ui-bump));
    color: var(--color-surface-400);
  }
  .update-found {
    color: var(--color-brand-400);
    font-weight: 500;
  }
  .update-ok {
    color: var(--color-success-muted);
  }
  .update-err {
    color: var(--color-danger-light);
  }
</style>
