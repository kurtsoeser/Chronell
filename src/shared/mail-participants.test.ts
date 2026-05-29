import { describe, expect, it } from 'vitest'
import {
  collectMessageParticipantEmails,
  parsePeopleContactEmails,
  resolveCorrespondenceEmailSet
} from './mail-participants'

describe('collectMessageParticipantEmails', () => {
  it('collects from to and cc', () => {
    const emails = collectMessageParticipantEmails({
      fromAddr: 'Me <me@test.de>',
      toAddrs: 'A <a@x.de>, b@y.de',
      ccAddrs: 'c@z.de'
    })
    expect(emails.sort()).toEqual(['a@x.de', 'b@y.de', 'c@z.de', 'me@test.de'].sort())
  })
})

describe('parsePeopleContactEmails', () => {
  it('parses emails_json', () => {
    expect(
      parsePeopleContactEmails(
        JSON.stringify([
          { address: 'Work@Example.com' },
          { address: 'other@example.com' }
        ])
      )
    ).toEqual(['work@example.com', 'other@example.com'])
  })
})

describe('resolveCorrespondenceEmailSet', () => {
  it('merges primary and aliases when enabled', () => {
    const set = resolveCorrespondenceEmailSet(
      'main@x.de',
      JSON.stringify([{ address: 'alias@x.de' }]),
      true
    )
    expect(set.sort()).toEqual(['alias@x.de', 'main@x.de'].sort())
  })
})
