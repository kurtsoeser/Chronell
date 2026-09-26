/** Graph MailboxConcurrency: max. ~4 gleichzeitige Anfragen pro Postfach — konservativ 2. */
export const GRAPH_MAILBOX_CONCURRENCY = 2

type AccountQueue = {
  running: number
  /** FIFO; Index 0 = naechster Slot. Prioritaets-Waiter werden vorne eingefuegt. */
  waiters: Array<() => void>
}

const queuesByAccount = new Map<string, AccountQueue>()

function queueFor(accountId: string): AccountQueue {
  let q = queuesByAccount.get(accountId)
  if (!q) {
    q = { running: 0, waiters: [] }
    queuesByAccount.set(accountId, q)
  }
  return q
}

export interface GraphMailboxSlotOptions {
  /**
   * Interaktive Requests (z. B. geoeffnete Mail-Vorschau) vor Hintergrund-Indexierung.
   * Default: false.
   */
  priority?: boolean
}

function acquireMailboxSlot(accountId: string, priority = false): Promise<void> {
  const q = queueFor(accountId)
  if (q.running < GRAPH_MAILBOX_CONCURRENCY) {
    q.running += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const wake = (): void => {
      q.running += 1
      resolve()
    }
    if (priority) q.waiters.unshift(wake)
    else q.waiters.push(wake)
  })
}

function releaseMailboxSlot(accountId: string): void {
  const q = queuesByAccount.get(accountId)
  if (!q) return
  q.running = Math.max(0, q.running - 1)
  const next = q.waiters.shift()
  if (next) next()
  if (q.running === 0 && q.waiters.length === 0) {
    queuesByAccount.delete(accountId)
  }
}

/** Begrenzt parallele Graph-Aufrufe pro Konto (MailboxConcurrency). */
export async function withGraphMailboxSlot<T>(
  accountId: string,
  fn: () => Promise<T>,
  opts?: GraphMailboxSlotOptions
): Promise<T> {
  await acquireMailboxSlot(accountId, opts?.priority === true)
  try {
    return await fn()
  } finally {
    releaseMailboxSlot(accountId)
  }
}
