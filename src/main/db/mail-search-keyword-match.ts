import { germanSearchTokenVariants, normalizeGermanFtsMatchQuery } from '@shared/german-search-token'
import {
  escapeSqlLikePattern,
  normalizeFtsPhraseMatchQuery,
  splitSearchTokens
} from '@shared/search-token-query'
import { hasMessageParticipantsIndex } from './message-participants-repo'

export interface MailKeywordMatchSql {
  /** SQL-Fragment (ohne führendes AND), z. B. `(m.id IN … OR m.id IN …)`. */
  sql: string
  params: unknown[]
}

function buildFtsMatchString(rawQuery: string): string | null {
  const tokens = normalizeGermanFtsMatchQuery(rawQuery)
  const phrase = normalizeFtsPhraseMatchQuery(rawQuery)
  if (tokens && phrase) return `${tokens} OR ${phrase}`
  return tokens ?? phrase
}

function tokenLikeOrClause(column: string, token: string, params: unknown[]): string {
  const variants = germanSearchTokenVariants(token)
  const likes = variants.length > 0 ? variants : [token]
  return likes
    .map((v) => {
      params.push(`%${escapeSqlLikePattern(v)}%`)
      return `LOWER(${column}) LIKE LOWER(?) ESCAPE '\\'`
    })
    .join(' OR ')
}

/**
 * Erweitert die Mail-Suche um FTS, Anhang-Dateinamen und Teilnehmer-E-Mails
 * (alle Tokens müssen jeweils in mindestens einer Quelle vorkommen).
 */
export function buildMailKeywordMatchSql(
  rawQuery: string,
  messageIdColumn = 'm.id'
): MailKeywordMatchSql | null {
  const fts = buildFtsMatchString(rawQuery)
  const tokens = splitSearchTokens(rawQuery)
  if (!fts && tokens.length === 0) return null

  const branches: string[] = []
  const params: unknown[] = []

  if (fts) {
    branches.push(
      `${messageIdColumn} IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)`
    )
    params.push(fts)
  }

  if (tokens.length > 0) {
    const attachParts = tokens.map((tok) => {
      const inner = tokenLikeOrClause('name', tok, params)
      return `${messageIdColumn} IN (
        SELECT message_id FROM attachments
        WHERE (${inner})
      )`
    })
    branches.push(`(${attachParts.join(' AND ')})`)

    if (hasMessageParticipantsIndex()) {
      const participantParts = tokens.map((tok) => {
        const inner = tokenLikeOrClause('email', tok, params)
        return `${messageIdColumn} IN (
          SELECT message_id FROM message_participants
          WHERE (${inner})
        )`
      })
      branches.push(`(${participantParts.join(' AND ')})`)
    }

    const addressParts = tokens.map((tok) => {
      const cols = [
        'IFNULL(m.from_addr, \'\')',
        'IFNULL(m.to_addrs, \'\')',
        'IFNULL(m.cc_addrs, \'\')',
        'IFNULL(m.bcc_addrs, \'\')'
      ]
      const variants = germanSearchTokenVariants(tok)
      const likes = variants.length > 0 ? variants : [tok]
      const colOrs: string[] = []
      for (const v of likes) {
        params.push(`%${escapeSqlLikePattern(v)}%`)
        for (const col of cols) {
          colOrs.push(`LOWER(${col}) LIKE LOWER(?) ESCAPE '\\'`)
        }
      }
      return `(${colOrs.join(' OR ')})`
    })
    branches.push(`(${addressParts.join(' AND ')})`)
  }

  if (branches.length === 0) return null
  return { sql: `(${branches.join(' OR ')})`, params }
}
