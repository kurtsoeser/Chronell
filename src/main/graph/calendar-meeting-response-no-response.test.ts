import { describe, expect, it } from 'vitest'
import { GraphError } from '@microsoft/microsoft-graph-client'
import { isOrganizerResponseNotRequestedError } from './calendar-meeting-response'

describe('isOrganizerResponseNotRequestedError', () => {
  it('erkennt die Standard-Graph-Meldung (ASCII)', () => {
    const e = new Error(
      "Your request can't be completed. The meeting organizer hasn't requested a response."
    )
    expect(isOrganizerResponseNotRequestedError(e)).toBe(true)
  })

  it('erkennt Unicode-Apostrophe in der Meldung', () => {
    const e = new Error(
      'Your request can\u2019t be completed. The meeting organizer hasn\u2019t requested a response.'
    )
    expect(isOrganizerResponseNotRequestedError(e)).toBe(true)
  })

  it('liest die Meldung aus GraphError.body (Objekt)', () => {
    const e = new GraphError(
      400,
      "Your request can't be completed. The meeting organizer hasn't requested a response."
    )
    e.code = 'ErrorInvalidRequest'
    e.body = {
      error: {
        code: 'ErrorInvalidRequest',
        message:
          "Your request can't be completed. The meeting organizer hasn't requested a response."
      }
    }
    expect(isOrganizerResponseNotRequestedError(e)).toBe(true)
  })

  it('liest die Meldung aus GraphError.body (JSON-String)', () => {
    const e = new GraphError(400, 'Error')
    e.body = JSON.stringify({
      error: {
        code: 'ErrorInvalidRequest',
        message:
          "Your request can't be completed. The meeting organizer hasn't requested a response."
      }
    })
    expect(isOrganizerResponseNotRequestedError(e)).toBe(true)
  })

  it('lehnt unrelated Fehler ab', () => {
    expect(isOrganizerResponseNotRequestedError(new Error('Mailbox unavailable'))).toBe(false)
    expect(isOrganizerResponseNotRequestedError(null)).toBe(false)
  })
})
