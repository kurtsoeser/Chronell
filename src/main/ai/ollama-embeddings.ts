import { AiConnectionsError } from '@shared/ai-connections'
import { DEFAULT_EMBEDDING_MODEL } from '@shared/entity-embeddings'
import { normalizeOllamaBaseUrl } from './ollama-provider'

const EMBED_TIMEOUT_MS = 60_000
const EMBED_BATCH_MAX = 16

export async function embedTextsWithOllama(input: {
  baseUrl: string
  model?: string
  texts: string[]
}): Promise<Float32Array[]> {
  const texts = input.texts.map((t) => t.trim()).filter((t) => t.length > 0)
  if (texts.length === 0) return []

  const root = normalizeOllamaBaseUrl(input.baseUrl)
  const model = input.model?.trim() || DEFAULT_EMBEDDING_MODEL
  const out: Float32Array[] = []

  for (let i = 0; i < texts.length; i += EMBED_BATCH_MAX) {
    const chunk = texts.slice(i, i + EMBED_BATCH_MAX)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS)
    try {
      const res = await fetch(`${root}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model, input: chunk })
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        if (res.status === 404) {
          throw new AiConnectionsError(
            'provider_error',
            `Embedding-Modell „${model}“ nicht gefunden. Bitte \`ollama pull ${model}\` ausführen.`
          )
        }
        throw new AiConnectionsError(
          'provider_error',
          `Ollama-Embedding fehlgeschlagen (${res.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`
        )
      }
      const payload = (await res.json()) as { embeddings?: number[][] }
      const rows = payload.embeddings
      if (!Array.isArray(rows) || rows.length !== chunk.length) {
        throw new AiConnectionsError('invalid_response', 'Ungültige Ollama-Embedding-Antwort.')
      }
      for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) {
          throw new AiConnectionsError('invalid_response', 'Leerer Embedding-Vektor.')
        }
        out.push(Float32Array.from(row))
      }
    } catch (err) {
      if (err instanceof AiConnectionsError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiConnectionsError('network', 'Zeitüberschreitung bei Ollama-Embedding.')
      }
      throw new AiConnectionsError(
        'network',
        err instanceof Error ? err.message : 'Netzwerkfehler bei Ollama-Embedding.'
      )
    } finally {
      clearTimeout(timer)
    }
  }
  return out
}

export async function embedTextWithOllama(
  baseUrl: string,
  text: string,
  model?: string
): Promise<Float32Array> {
  const [vec] = await embedTextsWithOllama({ baseUrl, model, texts: [text] })
  if (!vec) {
    throw new AiConnectionsError('invalid_response', 'Kein Embedding erzeugt.')
  }
  return vec
}
