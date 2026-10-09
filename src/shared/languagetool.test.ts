import { describe, expect, it } from 'vitest'
import {
  applyLanguageToolReplacements,
  normalizeLanguageToolApiBaseUrl,
  type LanguageToolMatch
} from './languagetool'

describe('applyLanguageToolReplacements', () => {
  it('wendet Ersetzungen von hinten nach vorne an', () => {
    const matches: LanguageToolMatch[] = [
      {
        message: 'a',
        shortMessage: 'a',
        offset: 0,
        length: 3,
        replacements: [{ value: 'Das' }],
        rule: { id: 'x', description: '', issueType: 'typographical' }
      }
    ]
    expect(applyLanguageToolReplacements('Dss ist', matches)).toBe('Das ist')
  })
})

describe('normalizeLanguageToolApiBaseUrl', () => {
  it('normalisiert die öffentliche API', () => {
    expect(normalizeLanguageToolApiBaseUrl('https://api.languagetool.org/v2/')).toBe(
      'https://api.languagetool.org/v2'
    )
  })

  it('lehnt ungültige URLs ab', () => {
    expect(normalizeLanguageToolApiBaseUrl('not a url')).toBeNull()
  })
})
