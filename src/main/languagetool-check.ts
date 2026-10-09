import {
  LANGUAGE_TOOL_PUBLIC_API_BASE,
  normalizeLanguageToolApiBaseUrl,
  type LanguageToolCheckResponse,
  type LanguageToolMatch
} from '@shared/languagetool'

const MAX_TEXT_CHARS = 20_000

export async function languageToolCheckText(input: {
  text: string
  language?: string
  apiBaseUrl?: string
  username?: string
  apiKey?: string
}): Promise<LanguageToolCheckResponse> {
  const text = input.text.trim()
  if (!text) {
    return { status: 'error', errorMessage: 'Kein Text zum Prüfen.' }
  }
  if (text.length > MAX_TEXT_CHARS) {
    return {
      status: 'error',
      errorMessage: `Text ist zu lang (max. ${MAX_TEXT_CHARS} Zeichen für LanguageTool).`
    }
  }

  const base =
    normalizeLanguageToolApiBaseUrl(input.apiBaseUrl?.trim() || '') ??
    LANGUAGE_TOOL_PUBLIC_API_BASE
  const language = (input.language?.trim() || 'de-DE').replace(/_/g, '-')

  const body = new URLSearchParams()
  body.set('text', text)
  body.set('language', language)
  const username = input.username?.trim()
  const apiKey = input.apiKey?.trim()
  if (username) body.set('username', username)
  if (apiKey) body.set('apiKey', apiKey)

  try {
    const res = await fetch(`${base}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        status: 'error',
        errorMessage: detail.trim()
          ? `LanguageTool (${res.status}): ${detail.slice(0, 400)}`
          : `LanguageTool-Anfrage fehlgeschlagen (${res.status}).`
      }
    }
    const json = (await res.json()) as {
      matches?: LanguageToolMatch[]
      language?: { name: string; code: string }
    }
    return {
      status: 'ok',
      language: json.language ?? { name: language, code: language },
      matches: Array.isArray(json.matches) ? json.matches : []
    }
  } catch (e) {
    return {
      status: 'error',
      errorMessage: e instanceof Error ? e.message : String(e)
    }
  }
}
