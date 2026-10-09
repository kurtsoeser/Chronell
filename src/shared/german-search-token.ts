import { SEARCH_TOKEN_MIN_LEN } from './search-token-query'

const UMLAUT_TO_ASCII: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss'
}

function foldUmlautsToAscii(s: string): string {
  return s.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_TO_ASCII[ch] ?? ch)
}

function asciiUmlautExpansions(s: string): string[] {
  const out = new Set<string>()
  const lower = s.toLowerCase()
  if (lower.includes('ae')) out.add(lower.replace(/ae/g, 'ä'))
  if (lower.includes('oe')) out.add(lower.replace(/oe/g, 'ö'))
  if (lower.includes('ue')) out.add(lower.replace(/ue/g, 'ü'))
  if (lower.includes('ss')) out.add(lower.replace(/ss/g, 'ß'))
  return [...out].filter((v) => v !== lower)
}

/** Varianten fuer LIKE/FTS (Umlaute, ss/ß, ae/oe/ue). */
export function germanSearchTokenVariants(token: string): string[] {
  const base = token.trim()
  if (base.length < SEARCH_TOKEN_MIN_LEN) return []
  const variants = new Set<string>([base, base.toLowerCase(), foldUmlautsToAscii(base)])
  const folded = foldUmlautsToAscii(base)
  if (folded !== base) variants.add(folded.toLowerCase())
  for (const exp of asciiUmlautExpansions(base)) {
    if (exp.length >= SEARCH_TOKEN_MIN_LEN) variants.add(exp)
  }
  if (base.includes('ß')) variants.add(base.replace(/ß/g, 'ss'))
  if (base.toLowerCase().includes('ss')) variants.add(base.replace(/ss/gi, 'ß'))
  return [...variants].filter((t) => t.length >= SEARCH_TOKEN_MIN_LEN)
}

function escapeFtsAtom(token: string): string {
  return token.replace(/"/g, '""')
}

/** FTS-Prefix-Gruppe pro Token inkl. deutscher Schreibvarianten. */
export function germanFtsPrefixGroup(token: string): string | null {
  const variants = germanSearchTokenVariants(token)
  if (variants.length === 0) return null
  const atoms = variants.map((v) => `${escapeFtsAtom(v)}*`)
  if (atoms.length === 1) return atoms[0]!
  return `(${atoms.join(' OR ')})`
}

/** FTS-UND ueber Tokens, jeweils mit Varianten-Prefix. */
export function normalizeGermanFtsMatchQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .replace(/["()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/[^\w\u00C0-\u017F]/g, ''))
    .filter((t) => t.length >= SEARCH_TOKEN_MIN_LEN)
  if (tokens.length === 0) return null
  const groups = tokens.map((t) => germanFtsPrefixGroup(t)).filter((g): g is string => Boolean(g))
  if (groups.length === 0) return null
  return groups.join(' ')
}
