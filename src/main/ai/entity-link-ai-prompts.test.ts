import { describe, expect, it } from 'vitest'
import { normalizeCustomDomainProfiles, resolveDomainProfile } from './entity-link-ai-prompts'

describe('resolveDomainProfile', () => {
  it('returns workshop addon and keywords', () => {
    const p = resolveDomainProfile('workshop_honorar', [])
    expect(p.subjectKeywords).toContain('honorar')
    expect(p.systemPromptAddon).toMatch(/Workshop/i)
  })

  it('resolves custom profile by id', () => {
    const p = resolveDomainProfile('proj_x', [
      { id: 'proj_x', label: 'Projekt X', keywords: ['alpha', 'angebot'] }
    ])
    expect(p.label).toBe('Projekt X')
    expect(p.subjectKeywords).toEqual(['alpha', 'angebot'])
  })

  it('falls back to general for unknown id', () => {
    const p = resolveDomainProfile('missing', [])
    expect(p.id).toBe('general')
  })
})

describe('normalizeCustomDomainProfiles', () => {
  it('parses comma-separated keywords string', () => {
    const rows = normalizeCustomDomainProfiles([
      { id: 'a', label: 'A', keywords: 'foo, bar' }
    ])
    expect(rows[0]?.keywords).toEqual(['foo', 'bar'])
  })
})
