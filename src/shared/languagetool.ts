export const LANGUAGE_TOOL_PUBLIC_API_BASE = 'https://api.languagetool.org/v2'

export interface LanguageToolMatch {
  message: string
  shortMessage: string
  offset: number
  length: number
  replacements: ReadonlyArray<{ value: string }>
  rule: { id: string; description: string; issueType: string }
}

export interface LanguageToolCheckResult {
  status: 'ok'
  language: { name: string; code: string }
  matches: LanguageToolMatch[]
}

export interface LanguageToolCheckError {
  status: 'error'
  errorMessage: string
}

export type LanguageToolCheckResponse = LanguageToolCheckResult | LanguageToolCheckError

export function languageToolMatchSnippet(text: string, match: LanguageToolMatch): string {
  if (match.offset < 0 || match.length <= 0) return ''
  return text.slice(match.offset, match.offset + match.length)
}

export function applyLanguageToolReplacements(
  text: string,
  matches: readonly LanguageToolMatch[],
  options?: { onlyWithReplacement?: boolean }
): string {
  const sorted = [...matches].sort((a, b) => b.offset - a.offset)
  let result = text
  for (const match of sorted) {
    const replacement = match.replacements[0]?.value
    if (!replacement) {
      if (options?.onlyWithReplacement) continue
      continue
    }
    if (match.offset < 0 || match.length < 0) continue
    if (match.offset + match.length > result.length) continue
    result = result.slice(0, match.offset) + replacement + result.slice(match.offset + match.length)
  }
  return result
}

export function normalizeLanguageToolApiBaseUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const path = url.pathname.replace(/\/+$/, '')
    if (url.hostname === 'api.languagetool.org') {
      return `${url.protocol}//${url.host}/v2`
    }
    return `${url.protocol}//${url.host}${path || ''}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}
