/** Mindestlaenge eines Such-Tokens (FTS und LIKE). */
export const SEARCH_TOKEN_MIN_LEN = 2

/**
 * Zerlegt eine Suchanfrage in normalisierte Tokens (Woerter >= 2 Zeichen).
 * Sonderzeichen in Tokens werden entfernt (Umlaute bleiben).
 */
export function splitSearchTokens(raw: string): string[] {
  return raw
    .trim()
    .replace(/["()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/[^\w\u00C0-\u017F]/g, ''))
    .filter((t) => t.length >= SEARCH_TOKEN_MIN_LEN)
}

/**
 * FTS5-MATCH-String (Prefix-Tokens, UND-Verknuepfung).
 * "HAK Steyr" -> "HAK* Steyr*"
 */
export function normalizeFtsMatchQuery(raw: string): string | null {
  const tokens = splitSearchTokens(raw)
  if (tokens.length === 0) return null
  const cleaned = tokens.map((t) => `${t}*`).join(' ')
  return cleaned.length > 0 ? cleaned : null
}

/** Normalisierte Phrase fuer exakten Teilstring-Vergleich (Leerzeichen, ohne Klammern/Anfuehrungszeichen). */
export function normalizeSearchPhrase(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/["()]/g, '')
    .replace(/\s+/g, ' ')
  if (cleaned.length < SEARCH_TOKEN_MIN_LEN) return null
  return cleaned
}

/** LIKE-Muster fuer exakte Phrase (Gross/Klein egal via LOWER in SQL). */
export function buildPhraseLikeNeedle(raw: string): string | null {
  const phrase = normalizeSearchPhrase(raw)
  if (!phrase) return null
  return `%${escapeSqlLikePattern(phrase)}%`
}

/**
 * FTS5-Phrase: benachbarte Tokens in dieser Reihenfolge.
 * "HAK Steyr" -> "HAK Steyr" (in Anfuehrungszeichen)
 */
export function normalizeFtsPhraseMatchQuery(raw: string): string | null {
  const tokens = splitSearchTokens(raw)
  if (tokens.length < 2) return null
  return `"${tokens.join(' ')}"`
}

/** Prefix-UND plus Phrase (breitere Treffer, Phrase-Ranking separat per ORDER BY). */
export function normalizeFtsTokenOrPhraseMatchQuery(raw: string): string | null {
  const tokens = normalizeFtsMatchQuery(raw)
  const phrase = normalizeFtsPhraseMatchQuery(raw)
  if (tokens && phrase) return `${tokens} OR ${phrase}`
  return tokens ?? phrase
}

export interface SqlPhraseRankCase {
  /** z. B. CASE WHEN LOWER(subject) LIKE … THEN 0 … END */
  sql: string
  params: string[]
}

/**
 * SQL-Rangstufe: exakte Phrase zuerst in primaryCol, dann secondaryCol, sonst Rest.
 */
export function buildSqlPhraseRankCase(
  primaryCol: string,
  secondaryCol: string | null,
  rawQuery: string
): SqlPhraseRankCase | null {
  const needle = buildPhraseLikeNeedle(rawQuery)
  if (!needle) return null
  if (secondaryCol) {
    return {
      sql: `CASE WHEN LOWER(${primaryCol}) LIKE LOWER(?) ESCAPE '\\' THEN 0 WHEN LOWER(${secondaryCol}) LIKE LOWER(?) ESCAPE '\\' THEN 1 ELSE 2 END`,
      params: [needle, needle]
    }
  }
  return {
    sql: `CASE WHEN LOWER(${primaryCol}) LIKE LOWER(?) ESCAPE '\\' THEN 0 ELSE 1 END`,
    params: [needle]
  }
}

/**
 * Phrase-Ranking ueber mehrere Spalten (niedrigste Stufe = beste Treffer).
 */
export function buildSqlPhraseRankCaseMulti(columns: string[], rawQuery: string): SqlPhraseRankCase | null {
  const needle = buildPhraseLikeNeedle(rawQuery)
  if (!needle || columns.length === 0) return null
  const whens = columns.map((col, i) => `WHEN LOWER(${col}) LIKE LOWER(?) ESCAPE '\\' THEN ${i}`)
  return {
    sql: `CASE ${whens.join(' ')} ELSE ${columns.length} END`,
    params: columns.map(() => needle)
  }
}

/** Prueft, ob alle Such-Tokens in mindestens einem der Texte vorkommen (Reihenfolge egal). */
export function textMatchesAllSearchTokens(
  rawQuery: string,
  ...texts: Array<string | null | undefined>
): boolean {
  const tokens = splitSearchTokens(rawQuery)
  if (tokens.length === 0) return false
  const hay = texts
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n')
    .toLowerCase()
  if (!hay) return false
  return tokens.every((tok) => hay.includes(tok.toLowerCase()))
}

export function escapeSqlLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * SQL-Fragment: fuer jedes Token (AND) muss mindestens eine Spalte LIKE matchen (OR).
 * Gibt null zurueck, wenn keine Tokens.
 */
export function buildSqlLikeTokenAndClause(
  columns: string[],
  rawQuery: string,
  params: unknown[]
): string | null {
  const tokens = splitSearchTokens(rawQuery)
  if (tokens.length === 0 || columns.length === 0) return null
  const perToken = tokens.map((tok) => {
    const like = `%${escapeSqlLikePattern(tok)}%`
    const ors = columns.map((col) => `LOWER(${col}) LIKE LOWER(?) ESCAPE '\\'`)
    for (let i = 0; i < columns.length; i++) params.push(like)
    return `(${ors.join(' OR ')})`
  })
  return perToken.join(' AND ')
}
