import { withGraphMailboxSlot } from './graph-mailbox-queue'
import { withGraphThrottleRetry } from './graph-api-throttle-retry'

/** Graph-Anfrage mit Mailbox-Slot + Drosselungs-Retry (429). */
export async function runGraphMailboxRequest<T>(
  accountId: string,
  opLabel: string,
  fn: () => Promise<T>
): Promise<T> {
  return withGraphMailboxSlot(accountId, () => withGraphThrottleRetry(opLabel, fn))
}
