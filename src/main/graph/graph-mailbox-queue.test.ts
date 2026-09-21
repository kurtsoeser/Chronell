import { describe, expect, it } from 'vitest'
import { GRAPH_MAILBOX_CONCURRENCY, withGraphMailboxSlot } from './graph-mailbox-queue'

describe('withGraphMailboxSlot', () => {
  it('begrenzt parallele Aufrufe pro Konto', async () => {
    let running = 0
    let maxRunning = 0
    const accountId = 'ms:test-account-concurrency'

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

  it('laesst priorisierte Waiter vor normalen Waitern starten', async () => {
    const accountId = 'ms:test-account-priority'
    const order: string[] = []
    const releaseHolders: Array<() => void> = []

    const holders = Array.from({ length: GRAPH_MAILBOX_CONCURRENCY }, (_, i) =>
      withGraphMailboxSlot(accountId, () =>
        new Promise<void>((resolve) => {
          releaseHolders.push((): void => {
            order.push(`hold-${i}`)
            resolve()
          })
        })
      )
    )

    await new Promise((r) => setTimeout(r, 5))

    const normal = withGraphMailboxSlot(accountId, async () => {
      order.push('normal')
    })
    const priority = withGraphMailboxSlot(
      accountId,
      async () => {
        order.push('priority')
      },
      { priority: true }
    )

    await new Promise((r) => setTimeout(r, 5))
    for (const release of releaseHolders) release()
    await Promise.all([...holders, normal, priority])

    expect(order.indexOf('priority')).toBeLessThan(order.indexOf('normal'))
  })
})
