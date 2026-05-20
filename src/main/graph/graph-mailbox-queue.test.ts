import { describe, expect, it } from 'vitest'
import { GRAPH_MAILBOX_CONCURRENCY, withGraphMailboxSlot } from './graph-mailbox-queue'

describe('withGraphMailboxSlot', () => {
  it('begrenzt parallele Aufrufe pro Konto', async () => {
    let running = 0
    let maxRunning = 0
    const accountId = 'ms:test-account'

    const work = async (ms: number): Promise<number> => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((r) => setTimeout(r, ms))
      running -= 1
      return ms
    }

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        withGraphMailboxSlot(accountId, () => work(20 + i))
      )
    )

    expect(maxRunning).toBeLessThanOrEqual(GRAPH_MAILBOX_CONCURRENCY)
  })
})
