import { describe, expect, it } from 'vitest'
import {
  graphPeopleSearchQuery,
  isCompleteEmailQuery,
  normalizeRecipientSuggestionQuery
} from './compose-recipient-query'

describe('normalizeRecipientSuggestionQuery', () => {
  it('extrahiert die Adresse aus Name <email>', () => {
    expect(normalizeRecipientSuggestionQuery('Claudia Walch <claudia.walch@ph-ooe.at>')).toBe(
      'claudia.walch@ph-ooe.at'
    )
  })

  it('entfernt haengende Klammer aus unvollstaendiger Eingabe', () => {
    expect(normalizeRecipientSuggestionQuery('claudia.walch@ph-ooe.at>')).toBe(
      'claudia.walch@ph-ooe.at'
    )
  })

  it('laesst Freitext und reine Adressen unveraendert', () => {
    expect(normalizeRecipientSuggestionQuery('claud')).toBe('claud')
    expect(normalizeRecipientSuggestionQuery('max@test.de')).toBe('max@test.de')
    expect(normalizeRecipientSuggestionQuery('  ')).toBe('')
  })
})

describe('graphPeopleSearchQuery', () => {
  it('liefert null fuer vollstaendige E-Mail-Adressen', () => {
    expect(graphPeopleSearchQuery('claudia.walch@ph-ooe.at')).toBeNull()
    expect(graphPeopleSearchQuery('Claudia Walch <claudia.walch@ph-ooe.at>')).toBeNull()
    expect(graphPeopleSearchQuery('claudia.walch@ph-ooe.at>')).toBeNull()
  })

  it('wandelt lokale Teile mit Punkt in suchbare Woerter um', () => {
    expect(graphPeopleSearchQuery('claudia.walch')).toBe('claudia walch')
  })

  it('nutzt den lokalen Teil vor @ ohne Punkt-Syntax', () => {
    expect(graphPeopleSearchQuery('claudia.walch@ph')).toBe('claudia walch')
  })

  it('laesst einfache Namensprefixe durch', () => {
    expect(graphPeopleSearchQuery('claud')).toBe('claud')
  })
})

describe('isCompleteEmailQuery', () => {
  it('erkennt vollstaendige Adressen', () => {
    expect(isCompleteEmailQuery('max@test.de')).toBe(true)
    expect(isCompleteEmailQuery('claud')).toBe(false)
  })
})
