import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import type {
  CopilotChatMessageAttribution,
  CopilotChatSendInput,
  CopilotChatSendResult,
  CopilotChatTurnResult
} from '@shared/types'

interface GraphConversationCreated {
  id?: string
  turnCount?: number
  status?: string
  state?: string
}

interface GraphConversationMessage {
  id?: string
  text?: string | null
  createdDateTime?: string | null
  attributions?: Array<{
    attributionType?: string | null
    providerDisplayName?: string | null
    seeMoreWebUrl?: string | null
    /** Manche Responses nutzen abweichende Feldnamen. */
    url?: string | null
    webUrl?: string | null
    displayName?: string | null
    sourceName?: string | null
  } | null> | null
  /**
   * Work IQ / Graph: keyed map citationIndex → { targetLink, isCitedInResponse }.
   * Enthält oft die echten Source-URLs, wenn `attributions` leer/dünn ist.
   */
  references?: Record<
    string,
    {
      targetLink?: string | null
      isCitedInResponse?: boolean | null
      '@odata.type'?: string
    } | null
  > | null
}

interface GraphConversationChatResponse {
  id?: string
  turnCount?: number
  messages?: GraphConversationMessage[] | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function emptyChatResult(
  status: CopilotChatSendResult['status'],
  extras?: Partial<CopilotChatSendResult>
): CopilotChatSendResult {
  return {
    status,
    conversationId: null,
    turnCount: 0,
    replyText: null,
    attributions: [],
    errorMessage: null,
    ...extras
  }
}

function mapMessageAttributions(row: GraphConversationMessage): CopilotChatMessageAttribution[] {
  const out: CopilotChatMessageAttribution[] = []
  const seen = new Set<string>()
  const push = (a: CopilotChatMessageAttribution): void => {
    if (!a.seeMoreWebUrl && !a.providerDisplayName) return
    const key = `${a.seeMoreWebUrl ?? ''}\n${a.providerDisplayName ?? ''}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(a)
  }

  for (const a of row.attributions ?? []) {
    if (!a) continue
    push({
      attributionType: a.attributionType?.trim() || null,
      providerDisplayName:
        a.providerDisplayName?.trim() ||
        a.displayName?.trim() ||
        a.sourceName?.trim() ||
        null,
      seeMoreWebUrl: a.seeMoreWebUrl?.trim() || a.webUrl?.trim() || a.url?.trim() || null
    })
  }

  // references: { "1": { targetLink }, "2": … } — oft die echten Citation-URLs
  const refs = row.references
  if (refs && typeof refs === 'object') {
    const keys = Object.keys(refs).sort((a, b) => {
      const na = Number(a)
      const nb = Number(b)
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
      return a.localeCompare(b)
    })
    for (const key of keys) {
      const ref = refs[key]
      const url = ref?.targetLink?.trim() || null
      if (!url) continue
      push({
        attributionType: 'citation',
        providerDisplayName: null,
        seeMoreWebUrl: url
      })
    }
  }

  // Markdown-Links im Antworttext ([Titel](url) / [1](url))
  const text = row.text ?? ''
  for (const m of text.matchAll(/\[([^\]]{0,120})\]\((https?:\/\/[^)\s]+)\)/gi)) {
    const label = m[1]?.trim() || null
    const url = m[2]?.trim() || null
    if (!url) continue
    push({
      attributionType: 'citation',
      providerDisplayName: label && !/^\d{1,2}$/.test(label) ? label : null,
      seeMoreWebUrl: url
    })
  }

  return out
}

export function pickCopilotAssistantReply(
  messages: GraphConversationMessage[] | null | undefined,
  userText: string
): { replyText: string; attributions: CopilotChatMessageAttribution[] } {
  const list = messages ?? []
  const user = userText.trim()

  // Alle Attributionen aus der Conversation sammeln (nicht nur letzte Message).
  const allAttrs: CopilotChatMessageAttribution[] = []
  const seen = new Set<string>()
  for (const row of list) {
    for (const a of mapMessageAttributions(row)) {
      const key = `${a.seeMoreWebUrl ?? ''}\n${a.providerDisplayName ?? ''}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      allAttrs.push(a)
    }
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i]
    const text = row?.text?.trim()
    if (!text) continue
    // User-Prompt (ggf. gekuerzt in der Response) ueberspringen
    if (text === user || (user.length > 80 && user.startsWith(text.slice(0, 80)))) continue
    if (user.length > 80 && text.startsWith(user.slice(0, Math.min(120, user.length)))) continue
    const local = mapMessageAttributions(row)
    // Citations zuerst (Annotationen ohne Namen sind Entity-Links)
    const citations = local.filter((a) => (a.attributionType || '').toLowerCase() === 'citation')
    const preferred = citations.length > 0 ? citations : local
    return {
      replyText: text,
      attributions: preferred.length > 0 ? preferred : allAttrs
    }
  }
  const last = list[list.length - 1]?.text?.trim() || ''
  return { replyText: last, attributions: allAttrs }
}

function hostTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatGraphError(e: GraphError): string {
  const parts = [
    e.statusCode ? `HTTP ${e.statusCode}` : null,
    e.code?.trim() || null,
    e.message?.trim() || null
  ].filter(Boolean)
  const body =
    typeof e.body === 'string'
      ? e.body.trim()
      : e.body && typeof e.body === 'object'
        ? JSON.stringify(e.body).slice(0, 500)
        : ''
  if (body && !parts.some((p) => p && body.includes(p))) {
    parts.push(body)
  }
  return parts.join(' — ') || 'Unbekannter Graph-Fehler'
}

/**
 * Microsoft 365 Copilot Chat API (Preview).
 * POST /beta/copilot/conversations → POST .../chat
 */
export async function graphCopilotChat(input: CopilotChatSendInput): Promise<CopilotChatSendResult> {
  const accountId = input.accountId?.trim() ?? ''
  if (!accountId.startsWith('ms:')) {
    return emptyChatResult('unsupported')
  }

  const message = input.message?.trim() ?? ''
  if (!message) {
    return emptyChatResult('error', { errorMessage: 'Leere Nachricht.' })
  }

  try {
    const client = await getClientFor(accountId)
    let conversationId = input.conversationId?.trim() || null

    if (!conversationId) {
      const created = (await client
        .api('/copilot/conversations')
        .version('beta')
        .post({})) as GraphConversationCreated
      conversationId = created.id?.trim() || null
      if (!conversationId) {
        return emptyChatResult('error', { errorMessage: 'Conversation konnte nicht angelegt werden.' })
      }
    }

    const body: Record<string, unknown> = {
      message: { text: message },
      locationHint: { timeZone: input.timeZone?.trim() || hostTimeZone() }
    }

    const contexts = (input.additionalContext ?? [])
      .map((c) => c?.trim())
      .filter((c): c is string => !!c)
    if (contexts.length > 0) {
      body.additionalContext = contexts.map((text) => ({ text }))
    }

    const files = (input.fileUris ?? [])
      .map((u) => u?.trim())
      .filter((u): u is string => !!u)
    const disableWeb = input.disableWebSearch === true
    if (files.length > 0 || disableWeb) {
      body.contextualResources = {
        ...(files.length > 0 ? { files: files.map((uri) => ({ uri })) } : {}),
        ...(disableWeb ? { webContext: { isWebEnabled: false } } : {})
      }
    }

    const res = (await client
      .api(`/copilot/conversations/${encodeURIComponent(conversationId)}/chat`)
      .version('beta')
      .post(body)) as GraphConversationChatResponse

    const picked = pickCopilotAssistantReply(res.messages, message)
    const turn: CopilotChatTurnResult = {
      conversationId: res.id?.trim() || conversationId,
      turnCount: typeof res.turnCount === 'number' ? res.turnCount : 0,
      replyText: picked.replyText,
      attributions: picked.attributions
    }

    if (!turn.replyText) {
      return emptyChatResult('error', {
        conversationId: turn.conversationId,
        turnCount: turn.turnCount,
        errorMessage: 'Leere Copilot-Antwort.'
      })
    }

    return {
      status: 'ok',
      conversationId: turn.conversationId,
      turnCount: turn.turnCount,
      replyText: turn.replyText,
      attributions: turn.attributions,
      errorMessage: null
    }
  } catch (e) {
    if (e instanceof GraphError) {
      const detail = formatGraphError(e)
      console.warn('[copilot-chat]', detail)
      const code = e.statusCode ?? 0
      if (code === 401 || code === 403) {
        return emptyChatResult('forbidden', { errorMessage: detail })
      }
      return emptyChatResult('error', { errorMessage: detail })
    }
    return emptyChatResult('error', {
      errorMessage: e instanceof Error ? e.message : String(e)
    })
  }
}
