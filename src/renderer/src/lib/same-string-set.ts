/** Vergleicht zwei String-Sets ohne Reihenfolge (für stabile React-State-Updates). */
export function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) {
    if (!b.has(x)) return false
  }
  return true
}
