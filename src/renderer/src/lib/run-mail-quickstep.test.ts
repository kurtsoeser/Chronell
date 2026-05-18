import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MailListItem } from '@shared/types'
import { runMailQuickStep } from './run-mail-quickstep'

function msg(id: number): MailListItem {
  return { id, accountId: 'a1', subject: 'Test' } as MailListItem
}

describe('runMailQuickStep', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      mailClient: {
        mail: {
          runQuickStep: vi.fn().mockResolvedValue(undefined)
        }
      }
    })
  })

  it('runs once for a single message', async () => {
    const m = msg(1)
    await runMailQuickStep(5, m)
    expect(window.mailClient.mail.runQuickStep).toHaveBeenCalledTimes(1)
    expect(window.mailClient.mail.runQuickStep).toHaveBeenCalledWith({
      quickStepId: 5,
      messageId: 1
    })
  })

  it('runs for every message in a conversation bulk', async () => {
    const m = msg(1)
    const bulk = [msg(1), msg(2), msg(3)]
    await runMailQuickStep(1, m, bulk)
    expect(window.mailClient.mail.runQuickStep).toHaveBeenCalledTimes(3)
    expect(window.mailClient.mail.runQuickStep).toHaveBeenCalledWith({
      quickStepId: 1,
      messageId: 2
    })
  })
})
