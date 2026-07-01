import { describe, expect, it } from 'vitest'
import { de, enUS } from 'date-fns/locale'
import {
  resolveCollatorLocale,
  resolveDateFnsLocale,
  resolveIntlLocaleTag
} from './date-fns-locale'

describe('resolveDateFnsLocale', () => {
  it('liefert de für deutsche Sprachcodes', () => {
    expect(resolveDateFnsLocale('de')).toBe(de)
    expect(resolveDateFnsLocale('de-DE')).toBe(de)
  })

  it('liefert enUS für andere Sprachen', () => {
    expect(resolveDateFnsLocale('en')).toBe(enUS)
    expect(resolveDateFnsLocale('fr')).toBe(enUS)
  })
})

describe('resolveCollatorLocale', () => {
  it('unterscheidet de und en', () => {
    expect(resolveCollatorLocale('de-AT')).toBe('de')
    expect(resolveCollatorLocale('en-US')).toBe('en')
  })
})

describe('resolveIntlLocaleTag', () => {
  it('mappt deutsche und englische Tags', () => {
    expect(resolveIntlLocaleTag('de')).toBe('de-DE')
    expect(resolveIntlLocaleTag('en')).toBe('en-GB')
    expect(resolveIntlLocaleTag('en', 'us')).toBe('en-US')
  })
})
