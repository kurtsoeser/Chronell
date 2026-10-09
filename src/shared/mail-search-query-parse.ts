import type { AdvancedMailSearchCriteria } from './types'
import type { MailSearchFolderScope } from './mail-search-scope'
import type { AdvancedSearchDateKind } from './mail-advanced-search'

const FIELD_PATTERN =
  /\b(von|from|an|to|cc|betreff|subject|kategorie|category|kat|ordner|folder|hat|has|gelesen|read|ungelesen|unread|empfangen|received|gesendet|sent|is|ist):(?:"([^"]*)"|([^\s]+))?/gi

export interface ParsedMailSearchQuery {
  freeText: string
  hasFieldSyntax: boolean
  fromContains?: string
  toContains?: string
  ccContains?: string
  subjectContains?: string
  categoryContains?: string
  folderScope?: MailSearchFolderScope
  hasAttachmentsOnly?: boolean
  readStatus?: 'read' | 'unread'
  dateKind?: AdvancedSearchDateKind
}

function likeMinLen(s: string): boolean {
  return s.trim().length >= 2
}

function mapFolderScope(raw: string): MailSearchFolderScope | null {
  const v = raw.trim().toLowerCase()
  if (v === 'alle' || v === 'all' || v === '*') return 'all'
  if (v === 'posteingang' || v === 'inbox' || v === 'eingang') return 'inbox'
  if (v === 'gesendet' || v === 'sent' || v === 'sentitems' || v === 'gesendete') return 'sent'
  if (v === 'archiv' || v === 'archive') return 'archive'
  if (v === 'aktuell' || v === 'current' || v === 'hier' || v === 'ordner') return 'current'
  return null
}

function mapHatValue(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  if (!v || v === 'anlage' || v === 'anlagen' || v === 'attachment' || v === 'attachments') {
    return true
  }
  return v === 'ja' || v === 'yes' || v === 'true' || v === '1'
}

function mapReadValue(key: string, raw: string): 'read' | 'unread' | null {
  const v = raw.trim().toLowerCase()
  const unreadKey = key === 'ungelesen' || key === 'unread'
  const readKey = key === 'gelesen' || key === 'read'
  if (unreadKey) {
    if (!v || v === 'ja' || v === 'yes' || v === 'true' || v === '1') return 'unread'
    return 'read'
  }
  if (readKey) {
    if (!v || v === 'ja' || v === 'yes' || v === 'true' || v === '1') return 'read'
    return 'unread'
  }
  return null
}

function mapDateKindKey(key: string): AdvancedSearchDateKind | null {
  const k = key.toLowerCase()
  if (k === 'gesendet' || k === 'sent') return 'sent'
  if (k === 'empfangen' || k === 'received') return 'received'
  return null
}

function applyField(parsed: ParsedMailSearchQuery, key: string, value: string): void {
  const k = key.toLowerCase()
  const v = value.trim()
  if (!v && k !== 'hat' && k !== 'has' && k !== 'gelesen' && k !== 'read' && k !== 'ungelesen' && k !== 'unread') {
    return
  }

  if (k === 'von' || k === 'from') {
    if (likeMinLen(v)) parsed.fromContains = v
    return
  }
  if (k === 'an' || k === 'to') {
    if (likeMinLen(v)) parsed.toContains = v
    return
  }
  if (k === 'cc') {
    if (likeMinLen(v)) parsed.ccContains = v
    return
  }
  if (k === 'betreff' || k === 'subject') {
    if (likeMinLen(v)) parsed.subjectContains = v
    return
  }
  if (k === 'kategorie' || k === 'category' || k === 'kat') {
    if (likeMinLen(v)) parsed.categoryContains = v
    return
  }
  if (k === 'ordner' || k === 'folder') {
    const scope = mapFolderScope(v)
    if (scope) parsed.folderScope = scope
    return
  }
  if (k === 'hat' || k === 'has') {
    if (mapHatValue(v)) parsed.hasAttachmentsOnly = true
    return
  }
  if (k === 'gelesen' || k === 'read' || k === 'ungelesen' || k === 'unread') {
    const st = mapReadValue(k, v)
    if (st) parsed.readStatus = st
    return
  }
  if (k === 'is' || k === 'ist') {
    const flag = v.toLowerCase()
    if (flag === 'unread' || flag === 'ungelesen') parsed.readStatus = 'unread'
    else if (flag === 'read' || flag === 'gelesen') parsed.readStatus = 'read'
    return
  }
  const dateKind = mapDateKindKey(k)
  if (dateKind) parsed.dateKind = dateKind
}

/**
 * Parst Outlook-aehnliche Feldpraefixe in der Suchleiste.
 * Beispiel: `von:Monika an:Monika betreff:Angebot hat:anlage ordner:gesendet Rechnung`
 */
export function parseMailSearchQuery(raw: string): ParsedMailSearchQuery {
  const parsed: ParsedMailSearchQuery = {
    freeText: '',
    hasFieldSyntax: false
  }
  let freeText = raw
  FIELD_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FIELD_PATTERN.exec(raw)) !== null) {
    parsed.hasFieldSyntax = true
    applyField(parsed, match[1]!, (match[2] ?? match[3] ?? '').trim())
    freeText = freeText.replace(match[0], ' ')
  }
  parsed.freeText = freeText.replace(/\s+/g, ' ').trim()
  return parsed
}

export function parsedMailSearchToAdvancedCriteria(
  parsed: ParsedMailSearchQuery
): AdvancedMailSearchCriteria {
  const c: AdvancedMailSearchCriteria = {}
  if (likeMinLen(parsed.fromContains ?? '')) c.fromContains = parsed.fromContains!.trim()
  if (likeMinLen(parsed.toContains ?? '')) c.toContains = parsed.toContains!.trim()
  if (likeMinLen(parsed.ccContains ?? '')) c.ccContains = parsed.ccContains!.trim()
  if (likeMinLen(parsed.subjectContains ?? '')) c.subjectContains = parsed.subjectContains!.trim()
  if (likeMinLen(parsed.categoryContains ?? '')) c.categoryContains = parsed.categoryContains!.trim()
  if (likeMinLen(parsed.freeText)) c.keywords = parsed.freeText.trim()
  if (parsed.readStatus === 'read' || parsed.readStatus === 'unread') {
    c.readStatus = parsed.readStatus
  }
  if (parsed.hasAttachmentsOnly) c.hasAttachmentsOnly = true
  if (parsed.dateKind === 'sent') c.dateKind = 'sent'
  return c
}

export function mailSearchQueryUsesFieldSyntax(raw: string): boolean {
  return parseMailSearchQuery(raw).hasFieldSyntax
}
