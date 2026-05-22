import { describe, expect, it } from 'vitest'
import { contactEmailsJsonContains, normalizeMailSenderEmail } from './mail-sender-email'

describe('normalizeMailSenderEmail', () => {
  it('extrahiert Adresse aus Anzeigenamen', () => {
    expect(normalizeMailSenderEmail('Max Mustermann <max@example.com>')).toBe('max@example.com')
  })

  it('normalisiert reine Adresse', () => {
    expect(normalizeMailSenderEmail('User@Example.COM')).toBe('user@example.com')
  })
})

describe('contactEmailsJsonContains', () => {
  it('findet sekundaere E-Mail in JSON', () => {
    const json = JSON.stringify([{ address: 'other@example.com', name: null }])
    expect(contactEmailsJsonContains(json, 'other@example.com')).toBe(true)
  })
})
