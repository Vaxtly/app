import { execFileSync } from 'child_process'
import { app, BrowserWindow, clipboard, nativeImage, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initEncryption } from './services/encryption'
import { openDatabase, closeDatabase, getDatabase } from './database/connection'
import { getWindowState, saveWindowState } from './database/repositories/settings'
import { buildMenu } from './menu'
import { registerWorkspaceHandlers } from './ipc/workspaces'
import { registerCollectionHandlers } from './ipc/collections'
import { registerFolderHandlers } from './ipc/folders'
import { registerRequestHandlers } from './ipc/requests'
import { registerEnvironmentHandlers } from './ipc/environments'
import { registerProxyHandlers } from './ipc/proxy'
import { registerSyncHandlers } from './ipc/sync'
import { registerVaultHandlers } from './ipc/vault'
import { registerSettingsHandlers } from './ipc/settings'
import { registerVariableHandlers } from './ipc/variables'
import { registerSessionLogHandlers } from './ipc/session-log'
import { registerCodeGeneratorHandlers } from './ipc/code-generator'
import { registerDataImportExportHandlers } from './ipc/data-import-export'
import { registerOAuth2Handlers } from './ipc/oauth2'
import { registerUpdaterHandlers } from './ipc/updater'
import { registerMcpHandlers } from './ipc/mcp'
import { registerWebSocketHandlers } from './ipc/websocket'
import { registerGraphqlHandlers } from './ipc/graphql'
import { registerCollectionRunnerHandlers } from './ipc/collection-runner'
import { registerCookieHandlers } from './ipc/cookies'
import { registerGraphqlSubscriptionHandlers } from './ipc/graphql-subscription'
import { disconnectAll as disconnectAllGqlSubs } from './services/graphql-subscription'
import { disconnectAll as disconnectAllMcpServers } from './services/mcp-client'
import { disconnectAll as disconnectAllWebSockets } from './services/websocket-client'
import * as agentSocket from './services/agent-socket'
import { initUpdater, checkForUpdates } from './services/updater'
import * as workspacesRepo from './database/repositories/workspaces'
import { getSetting, setSetting } from './database/repositories/settings'
import { encryptValue } from './services/encryption'
import * as vaultSyncService from './vault/vault-sync-service'
import * as remoteSyncService from './sync/remote-sync-service'
import { logVault, logSync } from './services/session-log'
import { IPC } from '../shared/types/ipc'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function getAppIcon(): Electron.NativeImage {
  const iconsDir = app.isPackaged
    ? join(process.resourcesPath, 'icons')
    : join(__dirname, '../../build/icons')
  const sizes = [16, 32, 48, 64, 128, 256, 512]
  const image = nativeImage.createEmpty()
  for (const size of sizes) {
    const sizePath = join(iconsDir, `${size}x${size}.png`)
    try {
      const sizeImage = nativeImage.createFromPath(sizePath)
      if (!sizeImage.isEmpty()) {
        image.addRepresentation({ width: size, height: size, buffer: sizeImage.toPNG() })
      }
    } catch {
      // skip missing sizes
    }
  }
  // Fallback to single icon.png if no sized icons found
  if (image.isEmpty()) {
    const fallback = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(__dirname, '../../build/icon.png')
    return nativeImage.createFromPath(fallback)
  }
  return image
}

function applyThemeSetting(): string {
  const theme = getSetting('app.theme') ?? 'dark'
  if (theme === 'light') {
    nativeTheme.themeSource = 'light'
    return '#ffffff'
  } else if (theme === 'system') {
    nativeTheme.themeSource = 'system'
    return nativeTheme.shouldUseDarkColors ? '#060c18' : '#ffffff'
  } else {
    nativeTheme.themeSource = 'dark'
    return '#060c18'
  }
}

function createSplashWindow(): Promise<BrowserWindow> {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#060c18',
    webPreferences: {
      preload: join(__dirname, '../preload/splash.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    splashWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/splash.html`)
  } else {
    splashWindow.loadFile(join(__dirname, '../renderer/splash.html'))
  }

  return new Promise((resolve) => {
    splashWindow!.webContents.once('did-finish-load', () => resolve(splashWindow!))
  })
}

function sendSplashStatus(text: string): void {
  splashWindow?.webContents.send('splash:status', text)
}

function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

function createWindow(): void {
  const state = getWindowState()
  const backgroundColor = applyThemeSetting()

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x ?? undefined,
    y: state.y ?? undefined,
    minWidth: 800,
    minHeight: 600,
    ...(process.platform !== 'darwin'
      ? { icon: getAppIcon() }
      : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor,
  })

  if (state.is_maximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    closeSplash()
    mainWindow?.show()
    runAutoSync()
    checkForUpdates()
  })

  mainWindow.on('focus', () => {
    try {
      // Skip clipboard read when it doesn't contain plain text — avoids triggering
      // lazy clipboard data transfers for large files/images (macOS pasteboard)
      const formats = clipboard.availableFormats()
      if (!formats.some((f) => f.startsWith('text/'))) return

      const text = clipboard.readText()
      // Cap at 100 KB — no valid cURL command is larger, and this prevents
      // sending huge strings over IPC (e.g. user copied a large file's content)
      if (text && text.length <= 100_000) {
        mainWindow?.webContents.send(IPC.CLIPBOARD_TEXT, text)
      }
    } catch {
      // Clipboard read can fail (OOM, permission error) — skip silently
    }
  })

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        is_maximized: mainWindow.isMaximized() ? 1 : 0,
      })
    }
  })

  // Block all navigation away from the app
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  // Open whitelisted external URLs in the system browser, deny everything else
  const ALLOWED_EXTERNAL_ORIGINS = ['https://github.com/vaxtly/', 'https://vaxtly.app/']
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_EXTERNAL_ORIGINS.some((origin) => url.startsWith(origin))) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Deny all permission requests (camera, mic, geolocation, etc.)
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _perm, callback) => {
    callback(false)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerAllIpcHandlers(): void {
  registerWorkspaceHandlers()
  registerCollectionHandlers()
  registerFolderHandlers()
  registerRequestHandlers()
  registerEnvironmentHandlers()
  registerProxyHandlers()
  registerSyncHandlers()
  registerVaultHandlers()
  registerSettingsHandlers()
  registerVariableHandlers()
  registerSessionLogHandlers()
  registerCodeGeneratorHandlers()
  registerDataImportExportHandlers()
  registerOAuth2Handlers()
  registerUpdaterHandlers()
  registerMcpHandlers()
  registerWebSocketHandlers()
  registerGraphqlHandlers()
  registerCollectionRunnerHandlers()
  registerCookieHandlers()
  registerGraphqlSubscriptionHandlers()
}

function ensureDefaultWorkspace(): void {
  const workspaces = workspacesRepo.findAll()
  if (workspaces.length === 0) {
    workspacesRepo.create({ name: 'Default Workspace' })
  }
}

function isEnabled(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

async function runAutoSync(): Promise<void> {
  // Resolve effective auto_sync per workspace (workspace setting → global fallback).
  // This mirrors how getProvider() resolves credentials, so the pull uses the same
  // config that the auto_sync toggle controls.
  const workspaces = workspacesRepo.findAll()

  for (const ws of workspaces) {
    const vaultAuto = workspacesRepo.getWorkspaceSetting(ws.id, 'vault.auto_sync') ?? getSetting('vault.auto_sync')
    if (isEnabled(vaultAuto) && vaultSyncService.isConfigured(ws.id)) {
      logVault('auto-sync', ws.name, 'Starting vault auto-sync...')
      try {
        const result = await vaultSyncService.pullAll(ws.id)
        if (result.errors.length > 0) {
          logVault('auto-sync', ws.name, `Completed with errors: ${result.errors.join('; ')}`, false)
        } else {
          const parts: string[] = []
          if (result.created) parts.push(`${result.created} created`)
          if (result.refreshed) parts.push(`${result.refreshed} refreshed`)
          logVault('auto-sync', ws.name, parts.length > 0 ? `Pulled: ${parts.join(', ')}` : 'Everything up to date')
        }
        if (result.created || result.refreshed) {
          mainWindow?.webContents.send(IPC.SYNC_PULL_COMPLETE, ws.id)
        }
      } catch (e) {
        logVault('auto-sync', ws.name, `Failed: ${e instanceof Error ? e.message : String(e)}`, false)
      }
    }

    const syncAuto = workspacesRepo.getWorkspaceSetting(ws.id, 'sync.auto_sync') ?? getSetting('sync.auto_sync')
    if (isEnabled(syncAuto)) {
      logSync('auto-sync', ws.name, 'Starting git auto-sync...')
      try {
        const result = await remoteSyncService.pull(ws.id)
        logSync('auto-sync', ws.name, result.message ?? `Pulled ${result.pulled ?? 0} collection(s)`, result.success)

        if (result.pulled && result.pulled > 0) {
          mainWindow?.webContents.send(IPC.SYNC_PULL_COMPLETE, ws.id)
        }
        if (result.conflicts && result.conflicts.length > 0) {
          mainWindow?.webContents.send(IPC.SYNC_CONFLICT, result.conflicts)
        }
        if (result.orphaned && result.orphaned.length > 0) {
          mainWindow?.webContents.send(IPC.SYNC_ORPHANED_COLLECTIONS, result.orphaned)
        }
        if (result.orphanedMcpServers && result.orphanedMcpServers.length > 0) {
          mainWindow?.webContents.send(IPC.SYNC_ORPHANED_MCP_SERVERS, result.orphanedMcpServers)
        }
      } catch (e) {
        logSync('auto-sync', ws.name, `Failed: ${e instanceof Error ? e.message : String(e)}`, false)
      }
    }
  }
}

/**
 * One-time migration: encrypt existing plaintext sensitive data.
 * After migration, all sensitive fields are stored encrypted in the DB.
 */
function migrateToEncryptedStorage(): void {
  const db = getDatabase()
  const marker = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('encryption.migrated') as { value: string } | undefined
  if (marker?.value === '1') return

  const SENSITIVE_SETTINGS = ['vault.token', 'vault.role_id', 'vault.secret_id', 'sync.token']

  // Re-write sensitive settings through the encrypt layer
  // getSetting now decrypts, setSetting now encrypts — for plaintext values,
  // getSetting returns them as-is (try/catch fallback), then setSetting encrypts them
  for (const key of SENSITIVE_SETTINGS) {
    const value = getSetting(key)
    if (value) {
      setSetting(key, value)
    }
  }

  // Re-write environment variable values
  const envRows = db.prepare('SELECT id, variables FROM environments').all() as { id: string; variables: string }[]
  for (const row of envRows) {
    if (!row.variables || row.variables === '[]') continue
    try {
      const vars = JSON.parse(row.variables) as { key: string; value: string; enabled: boolean }[]
      let changed = false
      const encrypted = vars.map((v) => {
        if (v.value && !v.value.startsWith('enc:')) {
          changed = true
          return { ...v, value: 'enc:' + encryptValue(v.value) }
        }
        return v
      })
      if (changed) {
        db.prepare('UPDATE environments SET variables = ? WHERE id = ?').run(JSON.stringify(encrypted), row.id)
      }
    } catch {
      // skip unparseable rows
    }
  }

  // Re-write request auth credentials
  const AUTH_FIELDS = ['bearer_token', 'basic_username', 'basic_password', 'api_key_value', 'oauth2_client_secret', 'oauth2_password', 'oauth2_access_token', 'oauth2_refresh_token']
  const reqRows = db.prepare('SELECT id, auth FROM requests WHERE auth IS NOT NULL').all() as { id: string; auth: string }[]
  for (const row of reqRows) {
    try {
      const auth = JSON.parse(row.auth)
      let changed = false
      for (const field of AUTH_FIELDS) {
        if (auth[field] && !auth[field].startsWith('enc:')) {
          auth[field] = 'enc:' + encryptValue(auth[field])
          changed = true
        }
      }
      if (changed) {
        db.prepare('UPDATE requests SET auth = ? WHERE id = ?').run(JSON.stringify(auth), row.id)
      }
    } catch {
      // skip unparseable rows
    }
  }

  // Mark migration as complete
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('encryption.migrated', '1')
    ON CONFLICT(key) DO UPDATE SET value = '1'
  `).run()
}

if (!app.isPackaged && process.env.VAXTLY_TEST_USERDATA) {
  app.setPath('userData', process.env.VAXTLY_TEST_USERDATA)
}

app.whenReady().then(async () => {
  // Fix $PATH on macOS/Linux when launched from GUI (Finder, Dock, desktop file).
  // Spawns the user's login shell and captures only $PATH — no other env vars
  // cross the process boundary (avoids leaking secrets from shell profiles).
  if (process.platform !== 'win32') {
    const loginShell = process.env.SHELL || '/bin/sh'
    const DELIM = '__VAXTLY_PATH__'
    try {
      const out = execFileSync(loginShell, [
        '-ilc',
        `echo ${DELIM} && printf '%s' "$PATH" && echo && echo ${DELIM}`,
      ], {
        encoding: 'utf8',
        timeout: 5000,
        env: { DISABLE_AUTO_UPDATE: 'true', ZSH_TMUX_AUTOSTARTED: 'true', ZSH_TMUX_AUTOSTART: 'false' },
      })
      const match = out.match(new RegExp(`${DELIM}\\n(.+)\\n${DELIM}`))
      if (match?.[1]) {
        process.env.PATH = match[1]
      }
    } catch {
      // Shell failed — keep the existing PATH
    }
  }

  // Show splash screen while the app initializes
  await createSplashWindow()

  sendSplashStatus('Initializing encryption...')
  initEncryption()

  sendSplashStatus('Opening database...')
  const dbPath = join(app.getPath('userData'), 'vaxtly.db')
  openDatabase(dbPath)

  sendSplashStatus('Running migrations...')
  migrateToEncryptedStorage()

  sendSplashStatus('Preparing workspace...')
  ensureDefaultWorkspace()

  // Register IPC handlers
  registerAllIpcHandlers()

  // Start the local agent socket so the bundled CLI / MCP wrapper can upsert
  // entities into the running app. Loopback-only Unix socket / named pipe,
  // token-gated via ~/.vaxtly/cli.json (0600). Non-fatal if it fails to bind.
  try {
    await agentSocket.start()
  } catch (err) {
    console.error('agent-socket failed to start:', err)
  }

  // Drop legacy request_histories table (feature removed)
  getDatabase().exec('DROP TABLE IF EXISTS request_histories')

  // Scrub orphaned secrets from vault-synced environments
  // (safety net for users who enabled vault sync before the fix that clears variables on toggle)
  getDatabase().prepare(`
    UPDATE environments SET variables = '[]', updated_at = datetime('now')
    WHERE vault_synced = 1 AND variables != '[]'
  `).run()

  // Build native menu
  buildMenu()

  // Persist current app version so the renderer can read it
  setSetting('app.version', app.getVersion())

  // Initialize auto-updater
  initUpdater()

  sendSplashStatus('Loading...')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  disconnectAllMcpServers()
  disconnectAllWebSockets()
  disconnectAllGqlSubs()
  agentSocket.stop()
  closeDatabase()
})
