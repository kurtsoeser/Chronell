/**
 * Bridge für Homepage-Screenshot-Capture (Main → Renderer).
 */
import { persistWorkContentViewMode } from '@/app/work/work-view-mode-storage'
import { persistTopbarModuleHiddenSet } from '@/app/layout/topbar-module-prefs'
import {
  requestCloseAccountSettings,
  requestOpenAccountSettings
} from '@/lib/open-account-settings'
import { useAppModeStore, type AppShellMode } from '@/stores/app-mode'
import { useMailStore } from '@/stores/mail'

export type HomepageCaptureShotId =
  | 'mail-triage'
  | 'calendar'
  | 'design'
  | 'connections'
  | 'work'
  | 'dashboard'

declare global {
  interface Window {
    __CHRONELL_HOMEPAGE_CAPTURE__?: {
      prepareShot: (shotId: HomepageCaptureShotId) => Promise<void>
      ready: () => boolean
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntil(predicate: () => boolean, timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await sleep(200)
  }
  return predicate()
}

async function closeOverlays(): Promise<void> {
  requestCloseAccountSettings()
  await sleep(350)
}

async function prepareMailTriage(): Promise<void> {
  useAppModeStore.getState().setMode('mail')
  await waitUntil(() => useMailStore.getState().messages.length > 0, 25_000)
  const msgs = useMailStore.getState().messages
  const pick =
    msgs.find((m) => m.isFlagged && !m.isRead)?.id ??
    msgs.find((m) => !m.isRead)?.id ??
    msgs[0]?.id
  if (pick != null) {
    await useMailStore.getState().selectMessage(pick)
    await sleep(700)
  }
}

async function prepareCalendar(): Promise<void> {
  useAppModeStore.getState().setMode('calendar')
  await sleep(1400)
}

async function prepareDesign(): Promise<void> {
  useAppModeStore.getState().setMode('home')
  await sleep(400)
  requestOpenAccountSettings({ tab: 'general', generalSubNav: 'appearance' })
  await sleep(1200)
}

async function prepareConnections(): Promise<void> {
  useAppModeStore.getState().setMode('connections')
  await sleep(1600)
}

async function prepareWork(): Promise<void> {
  // „Alle Arbeit“ ist standardmäßig ausgeblendet — für den Screenshot sichtbar machen.
  persistTopbarModuleHiddenSet(new Set())
  persistWorkContentViewMode('kanban')
  useAppModeStore.getState().setMode('home')
  await sleep(200)
  useAppModeStore.getState().setMode('work')
  await sleep(1600)
}

async function prepareDashboard(): Promise<void> {
  useAppModeStore.getState().setMode('home')
  await sleep(1400)
}

export function installHomepageCaptureBridge(): void {
  window.__CHRONELL_HOMEPAGE_CAPTURE__ = {
    ready(): boolean {
      return true
    },
    async prepareShot(shotId: HomepageCaptureShotId): Promise<void> {
      await closeOverlays()

      switch (shotId) {
        case 'mail-triage':
          await prepareMailTriage()
          break
        case 'calendar':
          await prepareCalendar()
          break
        case 'design':
          await prepareDesign()
          break
        case 'connections':
          await prepareConnections()
          break
        case 'work':
          await prepareWork()
          break
        case 'dashboard':
          await prepareDashboard()
          break
        default: {
          const mode = shotId as unknown as AppShellMode
          useAppModeStore.getState().setMode(mode)
          await sleep(800)
        }
      }
    }
  }
}
