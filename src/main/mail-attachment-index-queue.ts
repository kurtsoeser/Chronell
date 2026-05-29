import type { FilesMailIndexStatus } from '@shared/files'
import {
  countMessagesNeedingAttachmentIndex,
  listMessageIdsNeedingAttachmentIndex
} from './db/attachments-repo'
import { isAppOnline, registerAppConnectivityListener } from './network-status'
import { yieldToMainThread } from './lib/yield-main-thread'
import { indexMessageAttachments } from './mail-attachment-index-sync'

const DEBOUNCE_MS = 15_000
const BATCH_SIZE = 6
const TICK_INTERVAL_MS = 20_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let running = false
let enabled = true

export function setMailAttachmentIndexEnabled(value: boolean): void {
  enabled = value
  if (!value) stopMailAttachmentIndexRunner()
  else startMailAttachmentIndexRunner()
}

export function getMailAttachmentIndexStatus(): FilesMailIndexStatus {
  return {
    enabled,
    pending: enabled ? countMessagesNeedingAttachmentIndex() : 0
  }
}

export function queueMailAttachmentIndexAfterSync(_accountId?: string): void {
  if (!enabled) return
  scheduleFlush()
}

function scheduleFlush(): void {
  if (!enabled) return
  if (debounceTimer != null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushMailAttachmentIndexBatch()
  }, DEBOUNCE_MS)
}

async function flushMailAttachmentIndexBatch(): Promise<void> {
  if (running || !isAppOnline() || !enabled) return
  const pending = countMessagesNeedingAttachmentIndex()
  if (pending === 0) return

  running = true
  const ids = listMessageIdsNeedingAttachmentIndex(BATCH_SIZE)

  try {
    for (const id of ids) {
      if (!isAppOnline() || !enabled) break
      try {
        await indexMessageAttachments(id)
      } catch (e) {
        console.warn('[attachment-index] message', id, e)
      }
      await yieldToMainThread()
    }
  } finally {
    running = false
    const stillPending = countMessagesNeedingAttachmentIndex()
    if (stillPending > 0 && enabled) {
      scheduleFlush()
    }
  }
}

export function startMailAttachmentIndexRunner(): void {
  if (!enabled) return
  if (tickTimer != null) clearInterval(tickTimer)
  tickTimer = setInterval(() => {
    void flushMailAttachmentIndexBatch()
  }, TICK_INTERVAL_MS)
  scheduleFlush()
  void flushMailAttachmentIndexBatch()
}

export function stopMailAttachmentIndexRunner(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (tickTimer != null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  running = false
}

registerAppConnectivityListener((online) => {
  if (online && enabled) scheduleFlush()
})
