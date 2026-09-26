/** Microsoft 365 Copilot APIs (Chat Preview, Retrieval, Meeting Insights shared helpers). */

export type CopilotRetrievalDataSource = 'sharePoint' | 'oneDriveBusiness' | 'externalItem'

export interface CopilotChatMessageAttribution {
  attributionType: string | null
  providerDisplayName: string | null
  seeMoreWebUrl: string | null
}

export interface CopilotChatTurnResult {
  conversationId: string
  turnCount: number
  /** Letzte Assistenten-Antwort (Markdown/Plain). */
  replyText: string
  attributions: CopilotChatMessageAttribution[]
}

export type CopilotChatEngine = 'graph' | 'workiq' | 'gemini' | 'openai' | 'ollama'

export const COPILOT_API_ENGINES = ['gemini', 'openai', 'ollama'] as const
export type CopilotApiEngine = (typeof COPILOT_API_ENGINES)[number]

export function isCopilotApiEngine(engine: string | null | undefined): engine is CopilotApiEngine {
  return engine === 'gemini' || engine === 'openai' || engine === 'ollama'
}

export function isCopilotMicrosoftEngine(
  engine: string | null | undefined
): engine is 'graph' | 'workiq' {
  return engine === 'graph' || engine === 'workiq'
}

export function normalizeCopilotChatEngine(
  engine: string | null | undefined
): CopilotChatEngine {
  if (engine === 'workiq') return 'workiq'
  if (engine === 'gemini') return 'gemini'
  if (engine === 'openai') return 'openai'
  if (engine === 'ollama') return 'ollama'
  return 'graph'
}

export interface CopilotChatSendInput {
  accountId: string
  /** Bestehende Conversation fortsetzen; sonst neu anlegen. */
  conversationId?: string | null
  message: string
  /** IANA-Zeitzone; Default: Host-Zeitzone im Main-Process. */
  timeZone?: string | null
  /** Extra Grounding-Text (z. B. Mail-Body, Terminbeschreibung). */
  additionalContext?: string[] | null
  /** Web-Suche fuer diesen Turn abschalten (nur Enterprise Grounding). */
  disableWebSearch?: boolean | null
  /** OneDrive/SharePoint-Datei-URIs als Kontext. */
  fileUris?: string[] | null
  /** Spike: Work IQ statt Graph Copilot Chat; gemini/openai/ollama = KI-Anbindung. */
  engine?: CopilotChatEngine | null
}

export type CopilotChatSendStatus = 'ok' | 'unsupported' | 'forbidden' | 'error'

export interface CopilotChatSendResult {
  status: CopilotChatSendStatus
  conversationId: string | null
  turnCount: number
  replyText: string | null
  attributions: CopilotChatMessageAttribution[]
  errorMessage: string | null
}

export interface CopilotRetrievalHit {
  extract: string
  resourceUrl: string | null
  resourceTitle: string | null
  relevanceScore: number | null
}

export interface CopilotRetrievalInput {
  accountId: string
  queryString: string
  dataSource: CopilotRetrievalDataSource
  filterExpression?: string | null
  maximumNumberOfResults?: number | null
}

export type CopilotRetrievalStatus = 'ok' | 'empty' | 'unsupported' | 'forbidden' | 'error'

export interface CopilotRetrievalResult {
  status: CopilotRetrievalStatus
  hits: CopilotRetrievalHit[]
  errorMessage: string | null
}

/** Lokal gespeicherte Copilot-/Work-IQ-Antwort zu einer Mail. */
export interface MessageCopilotCacheEntry {
  messageId: number
  engine: CopilotChatEngine
  replyText: string
  attributions: CopilotChatMessageAttribution[]
  /** ISO-8601 UTC aus SQLite datetime('now'). */
  updatedAt: string
}

export interface MessageCopilotCacheGetInput {
  messageId: number
  engine: CopilotChatEngine
}

export interface MessageCopilotCacheSetInput {
  messageId: number
  engine: CopilotChatEngine
  replyText: string
  attributions: CopilotChatMessageAttribution[]
}
