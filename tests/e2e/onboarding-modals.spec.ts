/**
 * End-to-end tests for the first-launch + what's-new modal flow.
 *
 * Doesn't use the shared electronApp fixture because that fixture auto-dismisses
 * the WelcomeGuide on first launch — we need to actually observe it here.
 * Each test launches a fresh Electron process with isolated userdata so the
 * three scenarios are independent.
 */

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAIN_ENTRY = join(__dirname, '../../out/main/index.js')

async function launchWith(userDataDir: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      VAXTLY_TEST_USERDATA: userDataDir,
      VAXTLY_TEST_CLI_CONFIG_DIR: join(userDataDir, 'cli-config'),
      NODE_ENV: 'production',
    },
  })
}

/**
 * Vaxtly shows a splash window first, then the main renderer. `firstWindow()`
 * tends to return the splash (which closes shortly after), so we poll for the
 * main renderer instead — identified by its index.html URL.
 */
async function mainWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('index.html')) return w
      } catch {
        // Page may be transient (splash closing); ignore and retry.
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('main window did not appear within 20s')
}

// Use the system `sqlite3` CLI rather than better-sqlite3 to avoid the
// NODE_MODULE_VERSION mismatch between Electron's ABI (what the app uses) and
// the test runner's Node ABI. Trade-off: less type safety, but it's two SQL
// statements in a test helper.
function seedSettings(userDataDir: string, kv: Record<string, string>): void {
  const sql = Object.entries(kv)
    .map(([k, v]) => `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('${k.replace(/'/g, "''")}', '${v.replace(/'/g, "''")}');`)
    .join('\n')
  execFileSync('sqlite3', [join(userDataDir, 'vaxtly.db')], { input: sql, encoding: 'utf8' })
}

function readSetting(userDataDir: string, key: string): string | undefined {
  const out = execFileSync(
    'sqlite3',
    [join(userDataDir, 'vaxtly.db'), `SELECT value FROM app_settings WHERE key = '${key.replace(/'/g, "''")}'`],
    { encoding: 'utf8' },
  ).trim()
  return out === '' ? undefined : out
}

test('first launch ever: WelcomeGuide opens, then WhatsNewModal chains after Skip', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'vaxtly-modal-A-'))
  const app = await launchWith(userDataDir)
  const page = await mainWindow(app)

  // WelcomeGuide is up first — title of the very first step is "Welcome to Vaxtly"
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Welcome to Vaxtly', { exact: true })).toBeVisible({ timeout: 5_000 })

  // Skip the carousel
  await page.getByRole('button', { name: 'Skip' }).click()

  // WhatsNewModal should chain right after
  await expect(page.getByText('AI Agent Integration', { exact: true })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText(/Add the GET \/users endpoint to Vaxtly/i)).toBeVisible()
  await expect(page.getByText(/New in v/i)).toBeVisible()

  // Dismiss the WhatsNew modal
  await page.getByRole('button', { name: 'Got it' }).click()

  // Both modals gone
  await expect(page.getByText('AI Agent Integration', { exact: true })).not.toBeVisible()

  // Wait for the setting write IPC to land
  await page.waitForTimeout(500)
  await app.close()

  // last_seen_version got written
  const lastSeen = readSetting(userDataDir, 'app.last_seen_version')
  expect(lastSeen).toBeTruthy()
  expect(lastSeen).not.toBe('')
  // welcomed was set by WelcomeGuide on close
  expect(readSetting(userDataDir, 'app.welcomed')).toBe('true')

  await rm(userDataDir, { recursive: true, force: true })
})

test('upgrade scenario: WhatsNewModal opens directly (no WelcomeGuide)', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'vaxtly-modal-B-'))

  // First launch: let schema be created and dismiss welcome
  {
    const app = await launchWith(userDataDir)
    const page = await mainWindow(app)
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.waitForTimeout(500)
    // dismiss the chained WhatsNew if it appears on a fresh DB (it will — this
    // is scenario A, not B yet)
    const gotIt = page.getByRole('button', { name: 'Got it' })
    if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await gotIt.click()
      await page.waitForTimeout(300)
    }
    await app.close()
  }

  // Roll the version back so the relaunch looks like an upgrade
  seedSettings(userDataDir, {
    'app.welcomed': 'true',
    'app.last_seen_version': '0.0.0-old',
  })

  // Second launch: only WhatsNew should appear (no WelcomeGuide)
  const app = await launchWith(userDataDir)
  const page = await mainWindow(app)

  // WelcomeGuide must NOT be present (no "Skip" button visible)
  const skipBtn = page.getByRole('button', { name: 'Skip' })
  await expect(skipBtn).not.toBeVisible({ timeout: 5_000 })

  // WhatsNew is up
  await expect(page.getByRole('heading', { name: /AI Agent Integration/i })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Got it' }).click()
  await page.waitForTimeout(500)
  await app.close()

  // last_seen_version advanced past the seeded '0.0.0-old'
  const lastSeen = readSetting(userDataDir, 'app.last_seen_version')
  expect(lastSeen).toBeTruthy()
  expect(lastSeen).not.toBe('0.0.0-old')

  await rm(userDataDir, { recursive: true, force: true })
})

test('already current: neither modal opens, silent boot', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'vaxtly-modal-C-'))

  // Bootstrap the DB by launching once
  {
    const app = await launchWith(userDataDir)
    const page = await mainWindow(app)
    // dismiss whatever modals show on a fresh DB
    const skipBtn = page.getByRole('button', { name: 'Skip' })
    if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await skipBtn.click()
      await page.waitForTimeout(300)
    }
    const gotIt = page.getByRole('button', { name: 'Got it' })
    if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await gotIt.click()
      await page.waitForTimeout(300)
    }
    await app.close()
  }

  // The first launch set last_seen_version to the current version. Confirm.
  const seenAfterFirst = readSetting(userDataDir, 'app.last_seen_version')
  expect(seenAfterFirst).toBeTruthy()

  // Relaunch with state untouched — should be silent
  const app = await launchWith(userDataDir)
  const page = await mainWindow(app)

  // Wait long enough for the trigger logic to have fired if it were going to
  await page.waitForTimeout(2_000)

  // Neither modal is visible
  await expect(page.getByRole('button', { name: 'Skip' })).not.toBeVisible({ timeout: 1_000 })
  await expect(page.getByRole('button', { name: 'Got it' })).not.toBeVisible({ timeout: 1_000 })
  await expect(page.getByText('AI Agent Integration', { exact: true })).not.toBeVisible({ timeout: 1_000 })

  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
})
