import { describe, expect, it } from 'vitest'
import {
  domainLookupCandidates,
  extractEmailDomain,
  isGenericMailboxDomain
} from './extract-email-domain'

describe('extractEmailDomain', () => {
  it('liest Domain aus einfacher Adresse', () => {
    expect(extractEmailDomain('user@Flyeralarm.com')).toBe('flyeralarm.com')
  })

  it('liest Domain aus Anzeigenamen-Format', () => {
    expect(extractEmailDomain('FLYERALARM <orders@flyeralarm.com>')).toBe('flyeralarm.com')
  })

  it('gibt null bei leerer oder ungueltiger Adresse', () => {
    expect(extractEmailDomain('')).toBeNull()
    expect(extractEmailDomain('keine-email')).toBeNull()
  })
})

describe('isGenericMailboxDomain', () => {
  it('erkennt Freemail-Domains', () => {
    expect(isGenericMailboxDomain('gmail.com')).toBe(true)
    expect(isGenericMailboxDomain('outlook.com')).toBe(true)
  })

  it('laesst Organisations-Domains zu', () => {
    expect(isGenericMailboxDomain('flyeralarm.com')).toBe(false)
    expect(isGenericMailboxDomain('phwien.ac.at')).toBe(false)
  })
})

describe('domainLookupCandidates', () => {
  it('liefert Subdomain und Root-Domain', () => {
    expect(domainLookupCandidates('newsletter.flyeralarm.com')).toEqual([
      'newsletter.flyeralarm.com',
      'flyeralarm.com'
    ])
  })

  it('behaelt mehrteilige TLDs bei', () => {
    expect(domainLookupCandidates('phwien.ac.at')).toEqual(['phwien.ac.at', 'ac.at'])
  })
})
