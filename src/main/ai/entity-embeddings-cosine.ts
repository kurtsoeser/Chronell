/** Kosinus-Ähnlichkeit (Ollama-Embeddings sind L2-normalisiert → Dot-Produkt reicht). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let dot = 0
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!
  }
  return dot
}

export function topKByCosine(
  query: Float32Array,
  entries: Array<{ key: string; vector: Float32Array }>,
  k: number,
  exclude: Set<string>
): Array<{ key: string; score: number }> {
  const scored: Array<{ key: string; score: number }> = []
  for (const e of entries) {
    if (exclude.has(e.key)) continue
    scored.push({ key: e.key, score: cosineSimilarity(query, e.vector) })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(1, k))
}
