import { AiConnectionsError } from '@shared/ai-connections'
import type { AiJsonCompletionInput } from './ai-provider'

const OPENAI_TIMEOUT_MS = 45_000
const OPENAI_ASSIST_TIMEOUT_MS = 90_000

export type AiChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function completeJsonWithOpenAi(input: AiJsonCompletionInput): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ]
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 429) {
        throw new AiConnectionsError(
          'provider_error',
          'OpenAI-Kontingent erschöpft (429). Bitte Abrechnung prüfen, kurz warten oder eine andere Engine wählen.'
        )
      }
      if (res.status === 404) {
        throw new AiConnectionsError(
          'provider_error',
          `OpenAI-Modell „${input.model}“ ist nicht verfügbar (404).`
        )
      }
      throw new AiConnectionsError(
        'provider_error',
        `OpenAI-Anfrage fehlgeschlagen (${res.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`
      )
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const text = payload.choices?.[0]?.message?.content
    if (!text?.trim()) {
      throw new AiConnectionsError('invalid_response', 'Leere Antwort vom KI-Anbieter.')
    }
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new AiConnectionsError('invalid_response', 'KI-Antwort ist kein gültiges JSON.')
    }
  } catch (err) {
    if (err instanceof AiConnectionsError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiConnectionsError('network', 'Zeitüberschreitung bei der KI-Anfrage.')
    }
    throw new AiConnectionsError(
      'network',
      err instanceof Error ? err.message : 'Netzwerkfehler bei der KI-Anfrage.'
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function completeTextWithOpenAi(input: {
  apiKey: string
  model: string
  messages: AiChatMessage[]
}): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENAI_ASSIST_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: 0.4,
        messages: input.messages
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 429) {
        throw new AiConnectionsError(
          'provider_error',
          'OpenAI-Kontingent erschöpft (429). Bitte Abrechnung prüfen, kurz warten oder eine andere Engine wählen.'
        )
      }
      if (res.status === 404) {
        throw new AiConnectionsError(
          'provider_error',
          `OpenAI-Modell „${input.model}“ ist nicht verfügbar (404).`
        )
      }
      throw new AiConnectionsError(
        'provider_error',
        `OpenAI-Anfrage fehlgeschlagen (${res.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`
      )
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) {
      throw new AiConnectionsError('invalid_response', 'Leere Antwort vom KI-Anbieter.')
    }
    return text
  } catch (err) {
    if (err instanceof AiConnectionsError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiConnectionsError('network', 'Zeitüberschreitung bei der KI-Anfrage.')
    }
    throw new AiConnectionsError(
      'network',
      err instanceof Error ? err.message : 'Netzwerkfehler bei der KI-Anfrage.'
    )
  } finally {
    clearTimeout(timer)
  }
}
