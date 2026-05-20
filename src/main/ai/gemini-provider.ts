import { AiConnectionsError } from '@shared/ai-connections'
import type { AiJsonCompletionInput } from './ai-provider'

const GEMINI_TIMEOUT_MS = 45_000

export async function completeJsonWithGemini(input: AiJsonCompletionInput): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 429) {
        throw new AiConnectionsError(
          'provider_error',
          'Gemini-Kontingent erschöpft (429). Bitte Abrechnung/Quota in der Google AI Console prüfen oder später erneut versuchen.'
        )
      }
      if (res.status === 404) {
        throw new AiConnectionsError(
          'provider_error',
          `Gemini-Modell „${input.model}“ ist nicht verfügbar (404). In den Einstellungen unter KI-Verbindungen ein aktuelles Modell wählen (z. B. gemini-2.5-flash).`
        )
      }
      throw new AiConnectionsError(
        'provider_error',
        `Gemini-Anfrage fehlgeschlagen (${res.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`
      )
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
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
