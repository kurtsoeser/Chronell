import { describe, expect, it } from 'vitest'
import {
  parseMailSearchQuery,
  parsedMailSearchToAdvancedCriteria,
  mailSearchQueryUsesFieldSyntax
} from './mail-search-query-parse'

describe('parseMailSearchQuery', () => {
  it('parst Feldpraefixe und laesst Freitext', () => {
    const p = parseMailSearchQuery('von:Monika an:Monika betreff:Angebot hat:anlage ordner:gesendet Rechnung')
    expect(p.hasFieldSyntax).toBe(true)
    expect(p.fromContains).toBe('Monika')
    expect(p.toContains).toBe('Monika')
    expect(p.subjectContains).toBe('Angebot')
    expect(p.hasAttachmentsOnly).toBe(true)
    expect(p.folderScope).toBe('sent')
    expect(p.freeText).toBe('Rechnung')
  })

  it('unterstuetzt Anfuehrungszeichen', () => {
    const p = parseMailSearchQuery('von:"Monika Beispiel" test')
    expect(p.fromContains).toBe('Monika Beispiel')
    expect(p.freeText).toBe('test')
  })

  it('mappt ungelesen und kategorie', () => {
    const p = parseMailSearchQuery('ungelesen:ja kategorie:Rot ist:unread')
    expect(p.readStatus).toBe('unread')
    expect(p.categoryContains).toBe('Rot')
  })

  it('liefert keine Feld-Syntax bei reinem Text', () => {
    expect(mailSearchQueryUsesFieldSyntax('nur Freitext')).toBe(false)
  })

  it('wandelt in AdvancedMailSearchCriteria um', () => {
    const c = parsedMailSearchToAdvancedCriteria(parseMailSearchQuery('an:Monika foo'))
    expect(c.toContains).toBe('Monika')
    expect(c.keywords).toBe('foo')
  })
})
