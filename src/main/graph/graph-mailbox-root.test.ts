import { describe, expect, it } from 'vitest'
import { graphMailboxRoot, normalizeComposeEmail } from './graph-mailbox-root'

describe('graphMailboxRoot', () => {
  it('uses /me for primary address', () => {
    expect(graphMailboxRoot('User@Firma.de', null)).toBe('/me')
    expect(graphMailboxRoot('user@firma.de', 'user@firma.de')).toBe('/me')
  })

  it('uses /users/{smtp} for shared mailbox', () => {
    expect(graphMailboxRoot('user@firma.de', 'team@firma.de')).toBe(
      '/users/team%40firma.de'
    )
  })
})

describe('normalizeComposeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeComposeEmail('  Team@Firma.DE ')).toBe('team@firma.de')
  })
})
