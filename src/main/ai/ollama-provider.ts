import {
  AiConnectionsError,
  type OllamaConnectionTestResult,
  type OllamaModelEntry
} from '@shared/ai-connections'

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

const OLLAMA_TIMEOUT_MS = 120_000
const OLLAMA_TEST_CHAT_TIMEOUT_MS = 45_000
const OLLAMA_LIST_TIMEOUT_MS = 8_000

export interface OllamaJsonCompletionInput {
  baseUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
  timeoutMs?: number
}

export function normalizeOllamaBaseUrl(url: string | null | undefined): string {
  const trimmed = (url ?? DEFAULT_OLLAMA_BASE_URL).trim()
  if (!trimmed) return DEFAULT_OLLAMA_BASE_URL
  return trimmed.replace(/\/+$/, '')
}

export function parseOllamaTagsResponse(payload: unknown): OllamaModelEntry[] {
  if (!payload || typeof payload !== 'object') return []
  const models = (payload as { models?: unknown }).models
  if (!Array.isArray(models)) return []
  const out: OllamaModelEntry[] = []
  for (const row of models) {
    if (!row || typeof row !== 'object') continue
    const name =
      typeof (row as { name?: unknown }).name === 'string'
        ? (row as { name: string }).name.trim()
        : typeof (row as { model?: unknown }).model === 'string'
          ? (row as { model: string }).model.trim()
          : ''
    if (!name) continue
    const sizeRaw = (row as { size?: unknown }).size
    const sizeBytes =
      typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) ? Math.round(sizeRaw) : null
    out.push({ name, sizeBytes })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return out
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModelEntry[]> {
  const root = normalizeOllamaBaseUrl(baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_LIST_TIMEOUT_MS)
  try {
    const res = await fetch(`${root}/api/tags`, { signal: controller.signal })
    if (!res.ok) {
      throw new AiConnectionsError(
        'provider_error',
        `Ollama-Modellliste fehlgeschlagen (${res.status}). Läuft \`ollama serve\` unter ${root}?`
      )
    }
    return parseOllamaTagsResponse(await res.json())
  } catch (err) {
    if (err instanceof AiConnectionsError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiConnectionsError('network', 'Zeitüberschreitung beim Abfragen der Ollama-Modelle.')
    }
    throw new AiConnectionsError(
      'network',
      err instanceof Error
        ? `Ollama nicht erreichbar (${root}): ${err.message}`
        : 'Ollama nicht erreichbar.'
    )
  } finally {
    clearTimeout(timer)
  }
}

function extractJsonText(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fenced?.[1]) return fenced[1].trim()
  return trimmed
}

export async function completeJsonWithOllama(input: OllamaJsonCompletionInput): Promise<unknown> {
  const root = normalizeOllamaBaseUrl(input.baseUrl)
  const controller = new AbortController()
  const timeoutMs = input.timeoutMs ?? OLLAMA_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ],
        options: { temperature: 0.2 }
      })
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 404) {
        throw new AiConnectionsError(
          'provider_error',
          `Ollama-Modell „${input.model}“ nicht gefunden. Bitte \`ollama pull ${input.model}\` ausführen.`
        )
      }
      throw new AiConnectionsError(
        'provider_error',
        `Ollama-Anfrage fehlgeschlagen (${res.status}).${detail ? ` ${detail.slice(0, 200)}` : ''}`
      )
    }

    const payload = (await res.json()) as {
      message?: { content?: string | null }
    }
    const text = payload.message?.content
    if (!text?.trim()) {
      throw new AiConnectionsError('invalid_response', 'Leere Antwort von Ollama.')
    }
    try {
      return JSON.parse(extractJsonText(text)) as unknown
    } catch {
      throw new AiConnectionsError('invalid_response', 'Ollama-Antwort ist kein gültiges JSON.')
    }
  } catch (err) {
    if (err instanceof AiConnectionsError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiConnectionsError(
        'network',
        'Zeitüberschreitung bei der Ollama-Anfrage (große Modelle können mehrere Minuten brauchen).'
      )
    }
    throw new AiConnectionsError(
      'network',
      err instanceof Error ? err.message : 'Netzwerkfehler bei der Ollama-Anfrage.'
    )
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOllamaVersion(root: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_LIST_TIMEOUT_MS)
  try {
    const res = await fetch(`${root}/api/version`, { signal: controller.signal })
    if (!res.ok) return undefined
    const payload = (await res.json()) as { version?: string }
    return typeof payload.version === 'string' ? payload.version : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

function modelMatchesList(modelName: string, models: OllamaModelEntry[]): boolean {
  const want = modelName.trim().toLowerCase()
  return models.some((m) => {
    const n = m.name.toLowerCase()
    return n === want || n.startsWith(`${want}:`) || want.startsWith(`${n}:`)
  })
}

/** Server erreichbar; optional kurzer JSON-Chat mit gewähltem Modell. */
export async function testOllamaConnection(input: {
  baseUrl: string
  model?: string | null
}): Promise<OllamaConnectionTestResult> {
  const root = normalizeOllamaBaseUrl(input.baseUrl)
  const started = Date.now()
  const version = await fetchOllamaVersion(root)

  let models: OllamaModelEntry[] = []
  try {
    models = await listOllamaModels(root)
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Ollama nicht erreichbar.',
      modelCount: 0,
      serverVersion: version,
      latencyMs: Date.now() - started
    }
  }

  const modelName = input.model?.trim()
  if (!modelName) {
    const versionBit = version ? ` (Version ${version})` : ''
    return {
      ok: true,
      message: `Ollama erreichbar${versionBit} — ${models.length} installierte Modell${models.length === 1 ? '' : 'e'}.`,
      modelCount: models.length,
      serverVersion: version,
      latencyMs: Date.now() - started
    }
  }

  if (models.length > 0 && !modelMatchesList(modelName, models)) {
    return {
      ok: false,
      message: `Modell „${modelName}“ nicht lokal gefunden. Bitte \`ollama pull ${modelName}\` ausführen.`,
      modelCount: models.length,
      serverVersion: version,
      latencyMs: Date.now() - started
    }
  }

  try {
    const payload = await completeJsonWithOllama({
      baseUrl: root,
      model: modelName,
      systemPrompt: 'Antworte nur mit gültigem JSON {"ok":true}.',
      userPrompt: '{"ping":1}',
      timeoutMs: OLLAMA_TEST_CHAT_TIMEOUT_MS
    })
    const latencyMs = Date.now() - started
    const okJson =
      payload != null &&
      typeof payload === 'object' &&
      (payload as { ok?: unknown }).ok === true
    const seconds = Math.max(1, Math.round(latencyMs / 1000))
    return {
      ok: true,
      message: okJson
        ? `Verbindung OK — Modell „${modelName}“ antwortet (${seconds} s).`
        : `Modell „${modelName}“ erreichbar (Antwort in ${seconds} s, JSON-Format prüfen).`,
      modelCount: models.length,
      serverVersion: version,
      modelResponded: true,
      latencyMs
    }
  } catch (err) {
    const latencyMs = Date.now() - started
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : `Test mit Modell „${modelName}“ fehlgeschlagen.`,
      modelCount: models.length,
      serverVersion: version,
      latencyMs
    }
  }
}
