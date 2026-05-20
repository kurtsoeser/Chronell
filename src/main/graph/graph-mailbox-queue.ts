/** Graph MailboxConcurrency: max. ~4 gleichzeitige Anfragen pro Postfach — konservativ 3. */
export const GRAPH_MAILBOX_CONCURRENCY = 3

type AccountQueue = {
  running: number
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

function acquireMailboxSlot(accountId: string): Promise<void> {
  const q = queueFor(accountId)
  if (q.running < GRAPH_MAILBOX_CONCURRENCY) {
    q.running += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    q.waiters.push((): void => {
      q.running += 1
      resolve()
    })
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
  fn: () => Promise<T>
): Promise<T> {
  await acquireMailboxSlot(accountId)
  try {
    return await fn()
  } finally {
    releaseMailboxSlot(accountId)
  }
}
