import { randomUUID } from 'node:crypto'
import { AiConnectionsError, type AiConnectionsProvider } from '@shared/ai-connections'
import type {
  CopilotApiEngine,
  CopilotChatSendInput,
  CopilotChatSendResult
} from '@shared/types'
import { completeText, type AiChatMessage } from './ai-provider'
import { assertAiProviderReadyForAssistChat } from './ai-settings-store'

const SYSTEM_PROMPT =
  'Du bist ein hilfreicher Assistent in der Desktop-App Chronell (Mail, Kalender, Notizen). ' +
  'Antworte klar und strukturiert. Nutze nur den vom Nutzer gelieferten Kontext; erfinde keine Fakten. ' +
  'Keine Quellen-Erfindung. Wenn Infos fehlen, sage das kurz.'

const MAX_HISTORY_MESSAGES = 24

type StoredTurn = { role: 'user' | 'assistant'; content: string }

const conversations = new Map<string, StoredTurn[]>()

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

function buildUserMessage(input: CopilotChatSendInput): string {
  const parts: string[] = []
  const msg = input.message?.trim() ?? ''
  if (msg) parts.push(msg)
  const ctx = (input.additionalContext ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
  // Wenn der Client den Kontext schon in message eingebettet hat, nicht doppelt anhängen
  if (ctx.length > 0 && !msg.includes('--- CONTEXT ---') && !msg.includes('KONTEXT')) {
    parts.push('', '--- KONTEXT ---', ...ctx)
  }
  return parts.join('\n').trim()
}

export async function aiConnectionsCopilotChat(
  input: CopilotChatSendInput,
  engine: CopilotApiEngine
): Promise<CopilotChatSendResult> {
  const provider = engine as AiConnectionsProvider
  let ready: Awaited<ReturnType<typeof assertAiProviderReadyForAssistChat>>
  try {
    ready = await assertAiProviderReadyForAssistChat(provider)
  } catch (e) {
    if (e instanceof AiConnectionsError) {
      const status =
        e.code === 'consent_required' || e.code === 'no_api_key' || e.code === 'disabled'
          ? 'forbidden'
          : 'error'
      return emptyResult(status, { errorMessage: e.message })
    }
    return emptyResult('error', {
      errorMessage: e instanceof Error ? e.message : String(e)
    })
  }

  const userText = buildUserMessage(input)
  if (!userText) {
    return emptyResult('error', { errorMessage: 'Leere Nachricht.' })
  }

  let conversationId = input.conversationId?.trim() || null
  if (!conversationId || !conversations.has(conversationId)) {
    conversationId = randomUUID()
    conversations.set(conversationId, [])
  }
  const history = conversations.get(conversationId)!

  const messages: AiChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userText }
  ]

  try {
    const replyText = await completeText(provider, {
      apiKey: ready.apiKey,
      model: ready.model,
      ollamaBaseUrl: ready.ollamaBaseUrl,
      messages
    })

    history.push({ role: 'user', content: userText })
    history.push({ role: 'assistant', content: replyText })
    while (history.length > MAX_HISTORY_MESSAGES) {
      history.shift()
    }
    conversations.set(conversationId, history)

    return {
      status: 'ok',
      conversationId,
      turnCount: Math.ceil(history.length / 2),
      replyText,
      attributions: [],
      errorMessage: null
    }
  } catch (e) {
    if (e instanceof AiConnectionsError) {
      return emptyResult('error', { errorMessage: e.message, conversationId })
    }
    return emptyResult('error', {
      conversationId,
      errorMessage: e instanceof Error ? e.message : String(e)
    })
  }
}
