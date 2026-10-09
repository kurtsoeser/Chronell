/** Levenshtein-Distanz (kleine Wörter, konservativ). */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

function preserveWordCapitalization(original: string, suggestion: string): string {
  if (/^[A-ZÄÖÜ]/.test(original) && /^[a-zäöüß]/.test(suggestion)) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1)
  }
  return suggestion
}

/**
 * Nur bei sehr klaren Tippfehlern (genau ein Vorschlag, Distanz 1).
 * Keine Korrektur bei E-Mails, Zahlen, Großbuchstaben-Wörtern (AKRONYME).
 */
export function pickConservativeAutoCorrect(
  word: string,
  suggestions: readonly string[],
  blocklist: ReadonlySet<string>
): string | null {
  const trimmed = word.trim()
  if (trimmed.length < 3 || trimmed.length > 40) return null
  if (/[0-9@./:\\]/.test(trimmed)) return null
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) return null

  const lower = trimmed.toLowerCase()
  if (blocklist.has(lower)) return null

  const unique = suggestions
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== lower)
  if (unique.length === 0) return null

  const distanceOne = unique.filter((s) => levenshteinDistance(lower, s.toLowerCase()) === 1)
  if (distanceOne.length !== 1) return null

  return preserveWordCapitalization(trimmed, distanceOne[0])
}
