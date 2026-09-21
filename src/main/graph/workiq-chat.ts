import { loadConfig } from '../config'
import { acquireWorkIqAccessToken } from '../auth/microsoft-workiq'
import { pickCopilotAssistantReply } from './copilot-chat-graph'
import type { CopilotChatSendInput, CopilotChatSendResult } from '@shared/types'

/** Offizielles Sample nutzt /rest/beta — dort sind Citations/Attributions vollstaendiger. */
const WORKIQ_REST_BASE = 'https://workiq.svc.cloud.microsoft/rest/beta'

interface WorkIqConversationCreated {
  id?: string
  turnCount?: number
}

interface WorkIqChatResponse {
  id?: string
  turnCount?: number
  messages?: Array<{
    id?: string
    text?: string | null
    attributions?: Array<{
      attributionType?: string | null
      providerDisplayName?: string | null
      seeMoreWebUrl?: string | null
    } | null> | null
    references?: Record<
      string,
      { targetLink?: string | null; isCitedInResponse?: boolean | null } | null
    > | null
  }> | null
}

function emptyResult(
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

function hostTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

async function workIqFetchJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${WORKIQ_REST_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {})
    }
  })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 800) }
  }
  try {
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T }
  } catch {
    return { ok: false, status: res.status, body: `Ungueltiges JSON: ${text.slice(0, 200)}` }
  }
}

/**
 * Work IQ Chat (Spike) — eigene Ressource, starker Arbeits-/Enterprise-Kontext.
 * Voraussetzung: Tenant Work IQ enabled + Scope WorkIQAgent.Ask + ggf. Copilot Credits.
 */
export async function workIqCopilotChat(input: CopilotChatSendInput): Promise<CopilotChatSendResult> {
  const accountId = input.accountId?.trim() ?? ''
  if (!accountId.startsWith('ms:')) {
    return emptyResult('unsupported')
  }

  const message = input.message?.trim() ?? ''
  if (!message) {
    return emptyResult('error', { errorMessage: 'Leere Nachricht.' })
  }

  try {
    const config = await loadConfig()
    if (!config.microsoftClientId) {
      return emptyResult('error', { errorMessage: 'Keine Azure Client-ID konfiguriert.' })
    }

    const accessToken = await acquireWorkIqAccessToken(config.microsoftClientId, accountId)
    let conversationId = input.conversationId?.trim() || null

    if (!conversationId) {
      const created = await workIqFetchJson<WorkIqConversationCreated>('/conversations', accessToken, {
        method: 'POST',
        body: '{}'
      })
      if (!created.ok) {
        const detail = `HTTP ${created.status} — ${created.body || 'Work IQ Conversation fehlgeschlagen'}`
        console.warn('[workiq-chat] create', detail)
        if (created.status === 401 || created.status === 403) {
          return emptyResult('forbidden', { errorMessage: detail })
        }
        return emptyResult('error', { errorMessage: detail })
      }
      conversationId = created.data.id?.trim() || null
      if (!conversationId) {
        return emptyResult('error', { errorMessage: 'Work IQ Conversation ohne ID.' })
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

    const chat = await workIqFetchJson<WorkIqChatResponse>(
      `/conversations/${encodeURIComponent(conversationId)}/chat`,
      accessToken,
      { method: 'POST', body: JSON.stringify(body) }
    )

    if (!chat.ok) {
      const detail = `HTTP ${chat.status} — ${chat.body || 'Work IQ Chat fehlgeschlagen'}`
      console.warn('[workiq-chat] chat', detail)
      if (chat.status === 401 || chat.status === 403) {
        return emptyResult('forbidden', {
          conversationId,
          errorMessage: detail
        })
      }
      return emptyResult('error', { conversationId, errorMessage: detail })
    }

    const picked = pickCopilotAssistantReply(chat.data.messages, message)
    if (!picked.replyText) {
      return emptyResult('error', {
        conversationId: chat.data.id?.trim() || conversationId,
        turnCount: typeof chat.data.turnCount === 'number' ? chat.data.turnCount : 0,
        errorMessage: 'Leere Work IQ-Antwort.'
      })
    }

    const assistantMsg = [...(chat.data.messages ?? [])].reverse().find((m) => {
      const t = m.text?.trim()
      return t && t !== message.trim() && !message.trim().startsWith(t.slice(0, 80))
    })
    console.info(
      '[workiq-chat] reply chars=',
      picked.replyText.length,
      'attributions=',
      picked.attributions.length,
      'messages=',
      chat.data.messages?.length ?? 0,
      'rawAttr=',
      assistantMsg?.attributions?.length ?? 0,
      'rawRefs=',
      assistantMsg?.references ? Object.keys(assistantMsg.references).length : 0
    )
    if (picked.attributions.length === 0 && assistantMsg) {
      console.info(
        '[workiq-chat] no attributions — message keys:',
        Object.keys(assistantMsg),
        'attrSample=',
        JSON.stringify(assistantMsg.attributions?.[0] ?? null).slice(0, 300),
        'refSample=',
        JSON.stringify(assistantMsg.references ?? null).slice(0, 400)
      )
    }

    return {
      status: 'ok',
      conversationId: chat.data.id?.trim() || conversationId,
      turnCount: typeof chat.data.turnCount === 'number' ? chat.data.turnCount : 0,
      replyText: picked.replyText,
      attributions: picked.attributions,
      errorMessage: null
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[workiq-chat]', msg)
    if (/consent|AADSTS|InteractionRequired|invalid_scope|70011/i.test(msg)) {
      return emptyResult('forbidden', {
        errorMessage:
          `${msg}\n` +
          'Work IQ: In Entra „Work IQ“ / WorkIQAgent.Ask hinzufügen, Tenant aktivieren ' +
          '(Service Principal fdcc1f02-…), Admin-Consent, dann Konto erneut verbinden.'
      })
    }
    return emptyResult('error', { errorMessage: msg })
  }
}
