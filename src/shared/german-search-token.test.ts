import { describe, expect, it } from 'vitest'
import { germanSearchTokenVariants, normalizeGermanFtsMatchQuery } from './german-search-token'

describe('germanSearchTokenVariants', () => {
  it('liefert Umlaut- und ss-Varianten', () => {
    const v = germanSearchTokenVariants('Mueller')
    expect(v.some((x) => x.includes('ü') || x.includes('ue'))).toBe(true)
  })

  it('baut FTS-Gruppen mit OR', () => {
    const q = normalizeGermanFtsMatchQuery('Gruss')
    expect(q).toBeTruthy()
    expect(q).toContain('OR')
  })
})
