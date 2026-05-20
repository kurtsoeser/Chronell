import { describe, expect, it } from 'vitest'
import { cosineSimilarity, topKByCosine } from './entity-embeddings-cosine'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
  })
})

describe('topKByCosine', () => {
  it('excludes keys and returns top scores', () => {
    const q = new Float32Array([1, 0, 0])
    const hits = topKByCosine(
      q,
      [
        { key: 'a', vector: new Float32Array([1, 0, 0]) },
        { key: 'b', vector: new Float32Array([0, 1, 0]) },
        { key: 'skip', vector: new Float32Array([0.9, 0.1, 0]) }
      ],
      2,
      new Set(['skip'])
    )
    expect(hits[0]?.key).toBe('a')
    expect(hits.length).toBe(2)
  })
})
