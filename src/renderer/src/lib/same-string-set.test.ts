import { describe, expect, it } from 'vitest'
import { sameStringSet } from './same-string-set'

describe('sameStringSet', () => {
  it('erkennt gleiche Sets', () => {
    expect(sameStringSet(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
  })

  it('erkennt unterschiedliche Sets', () => {
    expect(sameStringSet(new Set(['a']), new Set(['a', 'b']))).toBe(false)
  })
})
