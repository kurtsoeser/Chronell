import { runBackgroundPoll } from './sync-runner'
import { wakeDueSnoozes } from './snooze'
import { isAppOnline } from './network-status'
import { clampMailPollIntervalSeconds } from '@shared/mail-poll-interval'
import { loadConfigSync } from './config'

let timer: NodeJS.Timeout | null = null
let stopRequested = false

/** Serialisiert Hintergrund- und manuelle Polls – kein stiller No-Op mehr. */
let tickQueue: Promise<void> = Promise.resolve()

/**
 * Liefert eine Folder-ID, die zusaetzlich zum Standard-Set (Inbox/Sent)
 * gepollt werden soll. Standard: aktuell vom Renderer ausgewaehlter Folder.
 * Vom Main aus aktualisieren wir den Wert via `setActivePollFolder`.
 */
let activeFolderId: number | null = null

export function setActivePollFolder(folderId: number | null): void {
  activeFolderId = folderId
}

function resolvePollIntervalMs(): number {
  const sec = loadConfigSync().mailPollIntervalSeconds ?? 30
  return clampMailPollIntervalSeconds(sec) * 1000
}

function scheduleNextPollTick(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  timer = setInterval(() => {
    enqueueTick()
  }, resolvePollIntervalMs())
}

function enqueueTick(): Promise<void> {
  tickQueue = tickQueue
    .then(() => executeTick())
    .catch((e) => {
      console.warn('[mail-poll] tick error', e)
    })
  return tickQueue
}

async function executeTick(): Promise<void> {
  if (stopRequested) return

  try {
    // Faellige Snoozes zuerst zurueckschieben, damit der nachfolgende Poll
    // sie sofort in ihren Original-Ordnern wiederfindet.
    try {
      const woken = await wakeDueSnoozes()
      if (woken > 0) console.log(`[snooze] ${woken} Mails aufgeweckt`)
    } catch (e) {
      console.warn('[snooze] wake-tick error', e)
    }

    if (isAppOnline()) {
      try {
        const { processScheduledComposeQueue } = await import('./compose-scheduled-runner')
        await processScheduledComposeQueue()
      } catch (e) {
        console.warn('[compose-scheduled] tick error', e)
      }

      const extra = activeFolderId != null ? [activeFolderId] : []
      await runBackgroundPoll(extra)
    }
  } catch (e) {
    console.warn('[mail-poll] executeTick error', e)
  }
}

export function startMailPolling(): void {
  if (timer) return
  stopRequested = false
  // Erster Tick verzoegert, damit Initial-Sync zuerst durchlaeuft.
  setTimeout(() => {
    void enqueueTick()
  }, 15_000)
  scheduleNextPollTick()
}

/** Nach Aenderung von `mailPollIntervalSeconds` in den Einstellungen. */
export function restartMailPollingInterval(): void {
  if (!timer) return
  scheduleNextPollTick()
}

export function stopMailPolling(): void {
  stopRequested = true
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/**
 * Manuelles Anstossen aus dem Renderer (z.B. ueber einen Refresh-Button).
 * Wartet auf laufende Ticks und fuehrt danach garantiert einen Poll aus.
 */
export async function triggerManualPoll(folderId: number | null): Promise<void> {
  setActivePollFolder(folderId)
  await enqueueTick()
}
