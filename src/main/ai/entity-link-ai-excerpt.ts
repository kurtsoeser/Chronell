/** Max. Zeichen für Snippet/Body-Auszug an die Cloud-KI (Phase 3). */
export const AI_TEXT_EXCERPT_MAX = 500

/** HTML/Whitespace zu Plaintext, dann kürzen. */
export function excerptPlainText(
  raw: string | null | undefined,
  maxLen = AI_TEXT_EXCERPT_MAX
): string | null {
  if (!raw?.trim()) return null
  const plain = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return null
  if (plain.length <= maxLen) return plain
  return `${plain.slice(0, maxLen)}…`
}
