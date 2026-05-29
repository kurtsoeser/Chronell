import { describe, expect, it } from 'vitest'
import { resolveCorrespondentFromMessage } from './mail-correspondent'

describe('resolveCorrespondentFromMessage', () => {
  const me = 'kurt@example.com'

  it('uses from on inbound mail', () => {
    expect(
      resolveCorrespondentFromMessage({
        fromAddr: 'Christoph Wimmer <chris@phwien.ac.at>',
        fromName: 'Christoph Wimmer',
        toAddrs: me,
        accountEmail: me,
        folderWellKnown: 'inbox'
      })
    ).toEqual({ email: 'chris@phwien.ac.at', displayName: 'Christoph Wimmer' })
  })

  it('uses first recipient on sent mail', () => {
    expect(
      resolveCorrespondentFromMessage({
        fromAddr: me,
        fromName: 'Kurt',
        toAddrs: 'Christoph Wimmer <chris@phwien.ac.at>',
        accountEmail: me,
        folderWellKnown: 'sentitems'
      })
    ).toEqual({ email: 'chris@phwien.ac.at', displayName: 'Christoph Wimmer' })
  })

  it('uses recipient when from is self in inbox', () => {
    expect(
      resolveCorrespondentFromMessage({
        fromAddr: me,
        fromName: 'Kurt',
        toAddrs: 'other@example.com',
        accountEmail: me,
        folderWellKnown: 'inbox'
      })
    ).toEqual({ email: 'other@example.com', displayName: null })
  })
})
