import type { MailBodyIndexProgress, MailBodyIndexSpeed, MailBodyIndexStatus } from '@shared/mail-body-index'
import {
  normalizeMailBodyIndexSpeed,
  resolveMailBodyIndexPreset
} from '@shared/mail-body-index'
import { loadConfigSync } from './config'
import {
  countMessagesNeedingBodyIndex,
  listMessageIdsNeedingBodyIndex
} from './db/messages-repo'
import { broadcastMailBodyIndexProgress } from './ipc/ipc-broadcasts'
import { fetchAndStoreMessageBodyIfMissing } from './message-body-fetch'
import { isAppOnline } from './network-status'
import { yieldToMainThread } from './lib/yield-main-thread'
import { registerMailBodyIndexRunner } from './mail-body-index-runner-bridge'

const DEBOUNCE_MS = 12_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let running = false
let indexedThisSession = 0
let lastProgress: MailBodyIndexProgress | null = null

function isIndexingEnabled(): boolean {
  return loadConfigSync().mailBodyIndexEnabled !== false
}

function resolveRunnerSettings(): { batchSize: number; intervalMs: number } {
  const speed = normalizeMailBodyIndexSpeed(loadConfigSync().mailBodyIndexSpeed)
  const preset = resolveMailBodyIndexPreset(speed)
  return {
    batchSize: preset.batchSize,
    intervalMs: preset.intervalSeconds * 1000
  }
}

function emitProgress(
  active: boolean,
  batchCurrent: number,
  batchTotal: number
): void {
  const pending = countMessagesNeedingBodyIndex()
  if (!isIndexingEnabled() || pending === 0) {
    lastProgress = null
    broadcastMailBodyIndexProgress(null)
    return
  }
  lastProgress = {
    pending,
    indexedThisSession,
    batchCurrent,
    batchTotal,
    active
  }
  broadcastMailBodyIndexProgress(lastProgress)
}

export function getMailBodyIndexStatus(): MailBodyIndexStatus {
  const cfg = loadConfigSync()
  const enabled = cfg.mailBodyIndexEnabled !== false
  const speed = normalizeMailBodyIndexSpeed(cfg.mailBodyIndexSpeed)
  const pending = enabled ? countMessagesNeedingBodyIndex() : 0
  return {
    enabled,
    speed,
    pending,
    progress: enabled && pending > 0 ? lastProgress : null
  }
}

export function queueMailBodyIndexAfterSync(_accountId?: string): void {
  if (!isIndexingEnabled()) return
  scheduleFlush()
}

function scheduleFlush(): void {
  if (!isIndexingEnabled()) return
  if (debounceTimer != null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushMailBodyIndexBatch()
  }, DEBOUNCE_MS)
}

async function flushMailBodyIndexBatch(): Promise<void> {
  if (running || !isAppOnline() || !isIndexingEnabled()) return
  const pending = countMessagesNeedingBodyIndex()
  if (pending === 0) {
    emitProgress(false, 0, 0)
    return
  }

  const { batchSize } = resolveRunnerSettings()
  running = true
  const ids = listMessageIdsNeedingBodyIndex(batchSize)
  emitProgress(true, 0, ids.length)

  try {
    let batchCurrent = 0
    for (const id of ids) {
      if (!isAppOnline() || !isIndexingEnabled()) break
      const stored = await fetchAndStoreMessageBodyIfMissing(id, { background: true })
      if (stored) indexedThisSession += 1
      batchCurrent += 1
      emitProgress(true, batchCurrent, ids.length)
      await yieldToMainThread()
    }
  } finally {
    running = false
    const stillPending = countMessagesNeedingBodyIndex()
    emitProgress(false, 0, 0)
    if (stillPending > 0 && isIndexingEnabled()) {
      scheduleFlush()
    }
  }
}

function scheduleTick(): void {
  if (tickTimer != null) clearInterval(tickTimer)
  if (!isIndexingEnabled()) return
  const { intervalMs } = resolveRunnerSettings()
  tickTimer = setInterval(() => {
    void flushMailBodyIndexBatch()
  }, intervalMs)
}

export function startMailBodyIndexRunner(): void {
  if (!isIndexingEnabled()) return
  scheduleTick()
  scheduleFlush()
  const pending = countMessagesNeedingBodyIndex()
  if (pending > 0) {
    emitProgress(false, 0, 0)
  }
}

export function restartMailBodyIndexRunner(): void {
  stopMailBodyIndexRunner()
  indexedThisSession = 0
  startMailBodyIndexRunner()
}

export function stopMailBodyIndexRunner(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (tickTimer != null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  running = false
  lastProgress = null
  broadcastMailBodyIndexProgress(null)
}

registerMailBodyIndexRunner({
  start: startMailBodyIndexRunner,
  stop: stopMailBodyIndexRunner,
  restart: restartMailBodyIndexRunner
})
