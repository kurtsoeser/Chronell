import { describe, expect, it } from 'vitest'
import { pickChromiumSpellCheckerLanguages } from './chromium-spellchecker-languages'

describe('pickChromiumSpellCheckerLanguages', () => {
  it('priorisiert Deutsch vor Englisch', () => {
    expect(
      pickChromiumSpellCheckerLanguages(['en-US', 'de-DE', 'fr-FR'])
    ).toEqual(['de-DE', 'en-US'])
  })

  it('nutzt de als Fallback wenn nur Kurzcode installiert ist', () => {
    expect(pickChromiumSpellCheckerLanguages(['en-GB', 'de'])).toEqual(['de', 'en-GB'])
  })

  it('gibt leeres Array zurück wenn keine Präferenz verfügbar ist', () => {
    expect(pickChromiumSpellCheckerLanguages(['fr-FR', 'es-ES'])).toEqual([])
  })
})
