import type { AiConnectionsSettings } from '@shared/ai-connections'
import type { CopilotChatEngine } from '@shared/types'
import { isCopilotApiEngine } from '@shared/types'

export type CopilotEngineOption = {
  value: CopilotChatEngine
  /** i18n key under copilot.assist.* */
  labelKey: string
}

/** API-Engine aus Anbindung (gewählter Provider), sofern Key/Modell bereit. */
export function resolvePreferredApiEngine(
  aiSettings: AiConnectionsSettings | null
): CopilotChatEngine | null {
  const s = aiSettings
  if (!s?.consentGiven) return null
  if (s.provider === 'gemini' && s.hasGeminiApiKey) return 'gemini'
  if (s.provider === 'openai' && s.hasOpenAiApiKey) return 'openai'
  if (s.provider === 'ollama' && Boolean(s.model?.trim())) return 'ollama'
  // Fallback: Gemini zuerst (Default bei Entity-Links), dann OpenAI, dann Ollama
  if (s.hasGeminiApiKey) return 'gemini'
  if (s.hasOpenAiApiKey) return 'openai'
  if (s.provider === 'ollama' && Boolean(s.model?.trim())) return 'ollama'
  return null
}

/** Engines die im Assist-/Compose-Dropdown angeboten werden. */
export function listCopilotEngineOptions(opts: {
  /** Microsoft-Konto (ms:…) — Graph (+ Work IQ wenn freigeschaltet). */
  microsoftAccount: boolean
  aiSettings: AiConnectionsSettings | null
  /** Work IQ nur wenn Scope/Tenant ok (Silent-Token oder nach Freischaltung). */
  workIqAvailable?: boolean
}): CopilotEngineOption[] {
  const out: CopilotEngineOption[] = []
  if (opts.microsoftAccount) {
    out.push({ value: 'graph', labelKey: 'copilot.assist.engineGraph' })
    if (opts.workIqAvailable) {
      out.push({ value: 'workiq', labelKey: 'copilot.assist.engineWorkIq' })
    }
  }
  const s = opts.aiSettings
  if (s?.consentGiven) {
    if (s.hasGeminiApiKey) {
      out.push({ value: 'gemini', labelKey: 'copilot.assist.engineGemini' })
    }
    if (s.hasOpenAiApiKey) {
      out.push({ value: 'openai', labelKey: 'copilot.assist.engineOpenAi' })
    }
    if (s.provider === 'ollama' && s.model?.trim()) {
      out.push({ value: 'ollama', labelKey: 'copilot.assist.engineOllama' })
    }
  }
  return out
}

/**
 * Empfohlene Defaults:
 * - Explizite Pref (Settings), sofern verfügbar
 * - MS-Konto → Graph Copilot
 * - Sonst gewählter Provider (bzw. Gemini, wenn Key da)
 * - Work IQ nie als Auto-Default
 */
export function defaultCopilotEngine(opts: {
  microsoftAccount: boolean
  aiSettings: AiConnectionsSettings | null
  preferred?: CopilotChatEngine | null
  workIqAvailable?: boolean
}): CopilotChatEngine {
  const options = listCopilotEngineOptions(opts)
  const values = new Set(options.map((o) => o.value))
  if (opts.preferred && values.has(opts.preferred)) return opts.preferred
  if (opts.microsoftAccount && values.has('graph')) return 'graph'
  const api = resolvePreferredApiEngine(opts.aiSettings)
  if (api && values.has(api)) return api
  const firstApi = options.find((o) => isCopilotApiEngine(o.value))
  if (firstApi) return firstApi.value
  return options[0]?.value ?? 'graph'
}

export function copilotEngineNeedsMicrosoftAccount(engine: CopilotChatEngine): boolean {
  return engine === 'graph' || engine === 'workiq'
}
