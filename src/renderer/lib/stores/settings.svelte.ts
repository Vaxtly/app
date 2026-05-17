/**
 * Settings store — app settings loaded from IPC, persisted on change.
 * Uses Svelte 5 runes for fine-grained reactivity.
 */

// --- Types ---

export interface SettingsMap {
  'request.layout': 'rows' | 'columns'
  'request.timeout': number
  'request.verify_ssl': boolean
  'request.follow_redirects': boolean
  'app.version': string
  'app.welcomed': boolean
  'app.last_seen_version': string
  'app.theme': 'dark' | 'light' | 'system'
  'app.text_size': 'sm' | 'md' | 'lg'
  'sidebar.width': number
  'request.splitPercent': number
  'mcp.splitPercent': number
  'tls.ca_cert_path': string
  'tls.client_cert_path': string
  'tls.client_key_path': string
  'tls.client_key_passphrase': string
  'proxy.url': string
  'proxy.username': string
  'proxy.password': string
  'proxy.no_proxy': string
}

type SettingsKey = keyof SettingsMap

// --- Defaults ---

const defaults: SettingsMap = {
  'request.layout': 'columns',
  'request.timeout': 30,
  'request.verify_ssl': true,
  'request.follow_redirects': true,
  'app.version': '0.0.0',
  'app.welcomed': false,
  'app.last_seen_version': '',
  'app.theme': 'dark',
  'app.text_size': 'md',
  'sidebar.width': 244,
  'request.splitPercent': 50,
  'mcp.splitPercent': 50,
  'tls.ca_cert_path': '',
  'tls.client_cert_path': '',
  'tls.client_key_path': '',
  'tls.client_key_passphrase': '',
  'proxy.url': '',
  'proxy.username': '',
  'proxy.password': '',
  'proxy.no_proxy': '',
}

// --- State ---

let settings = $state<SettingsMap>({ ...defaults })
let loaded = $state(false)

// --- Actions ---

async function loadAll(): Promise<void> {
  const all = await window.api.settings.getAll()
  for (const { key, value } of all) {
    if (key in defaults) {
      const k = key as SettingsKey
      const def = defaults[k]
      if (typeof def === 'boolean') {
        (settings as Record<string, unknown>)[k] = value === 'true' || value === '1'
      } else if (typeof def === 'number') {
        (settings as Record<string, unknown>)[k] = Number(value) || def
      } else {
        (settings as Record<string, unknown>)[k] = value
      }
    }
  }
  loaded = true
}

async function set<K extends SettingsKey>(key: K, value: SettingsMap[K]): Promise<void> {
  (settings as Record<string, unknown>)[key] = value
  await window.api.settings.set(key, String(value))
}

function get<K extends SettingsKey>(key: K): SettingsMap[K] {
  return settings[key]
}

// --- Export ---

export const settingsStore = {
  get settings() { return settings },
  get loaded() { return loaded },

  loadAll,
  get,
  set,
}
