import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEBINAR_FROM_MAILBOX,
  normalizeWebinarFromMailbox
} from './webinar-from-mailbox'

describe('normalizeWebinarFromMailbox', () => {
  it('Default bei leer', () => {
    expect(normalizeWebinarFromMailbox('')).toBe(DEFAULT_WEBINAR_FROM_MAILBOX)
    expect(normalizeWebinarFromMailbox(null)).toBe(DEFAULT_WEBINAR_FROM_MAILBOX)
  })

  it('normalisiert gültige SMTP', () => {
    expect(normalizeWebinarFromMailbox('Events@Kurtrocks.com')).toBe(
      'events@kurtrocks.com'
    )
  })

  it('Fallback bei Ungültigem', () => {
    expect(normalizeWebinarFromMailbox('kein-mail')).toBe(DEFAULT_WEBINAR_FROM_MAILBOX)
  })
})
