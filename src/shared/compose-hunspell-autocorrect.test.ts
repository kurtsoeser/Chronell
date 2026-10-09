import { describe, expect, it } from 'vitest'
import { levenshteinDistance, pickConservativeAutoCorrect } from './compose-hunspell-autocorrect'

describe('pickConservativeAutoCorrect', () => {
  const block = new Set<string>()

  it('korrigiert klare Einbuchstabierfehler', () => {
    expect(pickConservativeAutoCorrect('dss', ['das'], block)).toBe('das')
  })

  it('korrigiert nicht bei mehreren Vorschlägen mit Distanz 1', () => {
    expect(pickConservativeAutoCorrect('haus', ['maus', 'laus'], block)).toBeNull()
  })

  it('respektiert Blockliste', () => {
    expect(pickConservativeAutoCorrect('dss', ['das'], new Set(['dss']))).toBeNull()
  })

  it('überspringt Akronyme', () => {
    expect(pickConservativeAutoCorrect('API', ['APE'], block)).toBeNull()
  })
})

describe('levenshteinDistance', () => {
  it('ist 1 bei einem Tippfehler', () => {
    expect(levenshteinDistance('das', 'dss')).toBe(1)
  })
})
