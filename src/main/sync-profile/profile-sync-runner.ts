import { clampProfileSyncPollIntervalSeconds } from '@shared/profile-sync-poll-interval'
import { loadConfig, loadConfigSync } from '../config'
import { getCachedProfileUiPrefs } from './profile-sync-ui-prefs-cache'
import { runProfileSyncInternal } from './profile-sync-service'
import {
  cancelScheduledProfileSync,
  scheduleProfileSyncDebounced,
  setProfileSyncDebouncedHandler
} from './profile-sync-scheduler'
import {
  broadcastProfileSyncApplied,
  broadcastProfileSyncStatus
} from './profile-sync-status-broadcast'
import { registerProfileSyncRunner } from './profile-sync-runner-bridge'

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollStopped = true
let startupDone = false

function scheduleNextPoll(): void {
  if (pollStopped) return
  if (pollTimer != null) clearTimeout(pollTimer)
  pollTimer = setTimeout(() => {
    pollTimer = null
    void runAutoSync().finally(() => {
      scheduleNextPoll()
    })
  }, readPollIntervalMsSync())
}

async function runAutoSync(): Promise<void> {
  const config = await loadConfig()
  if (config.profileDataMode !== 'cloud') return
  const result = await runProfileSyncInternal({
    localStorage: getCachedProfileUiPrefs(),
    source: 'auto'
  })
  if (result.ok && result.localStorage) {
    broadcastProfileSyncApplied(result.localStorage)
  }
  void broadcastProfileSyncStatus()
}

function readPollIntervalMsSync(): number {
  const s = loadConfigSync().profileSyncPollIntervalSeconds
  return clampProfileSyncPollIntervalSeconds(s ?? 300) * 1000
}

export function startProfileSyncRunner(): void {
  setProfileSyncDebouncedHandler(() => {
    void runAutoSync()
  })

  if (!pollStopped) return

  pollStopped = false
  scheduleNextPoll()

  if (!startupDone) {
    startupDone = true
    setTimeout(() => {
      void runAutoSync()
    }, 8000)
  }
}

export function stopProfileSyncRunner(): void {
  cancelScheduledProfileSync()
  pollStopped = true
  if (pollTimer != null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  startupDone = false
}

export function restartProfileSyncRunner(): void {
  stopProfileSyncRunner()
  startProfileSyncRunner()
}

registerProfileSyncRunner({
  start: startProfileSyncRunner,
  stop: stopProfileSyncRunner,
  restart: restartProfileSyncRunner
})
