/**
 * Benutzerdefinierte Copilot-Prompts (lokal). Leer / fehlend = i18n-Default.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const COPILOT_PROMPT_PREFS_CHANGED_EVENT = 'mailclient:copilot-prompt-prefs-changed'

const STORAGE_KEY = 'mailclient.copilot.promptPrefs.v1'

/** Stabile IDs — i18n-Defaults leben unter `defaultI18nKey`. */
export const COPILOT_PROMPT_IDS = [
  'mail.summarize',
  'compose.new',
  'compose.reply',
  'compose.forward',
  'contact.summarize',
  'meeting.prepare',
  'meeting.review',
  'assist.workIqExtra'
] as const

export type CopilotPromptId = (typeof COPILOT_PROMPT_IDS)[number]

export const COPILOT_PROMPT_DEFAULT_I18N_KEY: Record<CopilotPromptId, string> = {
  'mail.summarize': 'copilot.mail.summarizePrompt',
  'compose.new': 'copilot.compose.newPrompt',
  'compose.reply': 'copilot.compose.replyPrompt',
  'compose.forward': 'copilot.compose.forwardPrompt',
  'contact.summarize': 'copilot.contact.summarizePrompt',
  'meeting.prepare': 'copilot.meeting.preparePrompt',
  'meeting.review': 'copilot.meeting.reviewPrompt',
  'assist.workIqExtra': 'copilot.assist.workIqPromptExtra'
}

export type CopilotPromptPrefsV1 = Partial<Record<CopilotPromptId, string>>

function isPromptId(raw: string): raw is CopilotPromptId {
  return (COPILOT_PROMPT_IDS as readonly string[]).includes(raw)
}

function parsePrefs(raw: string): CopilotPromptPrefsV1 {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const out: CopilotPromptPrefsV1 = {}
  for (const [k, v] of Object.entries(parsed)) {
    if (!isPromptId(k)) continue
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) continue
    out[k] = trimmed
  }
  return out
}

export function readCopilotPromptPrefs(): CopilotPromptPrefsV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return parsePrefs(raw)
  } catch {
    // ignore
  }
  return {}
}

export function persistCopilotPromptPrefs(prefs: CopilotPromptPrefsV1): void {
  const cleaned: CopilotPromptPrefsV1 = {}
  for (const id of COPILOT_PROMPT_IDS) {
    const v = prefs[id]?.trim()
    if (v) cleaned[id] = v
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    window.dispatchEvent(new CustomEvent(COPILOT_PROMPT_PREFS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function setCopilotPromptPref(id: CopilotPromptId, value: string | null): void {
  const next = { ...readCopilotPromptPrefs() }
  const trimmed = value?.trim() ?? ''
  if (trimmed) next[id] = trimmed
  else delete next[id]
  persistCopilotPromptPrefs(next)
}

export function resetCopilotPromptPref(id: CopilotPromptId): void {
  setCopilotPromptPref(id, null)
}

export function resetAllCopilotPromptPrefs(): void {
  persistCopilotPromptPrefs({})
}

/** Custom-Text oder i18n-Default. */
export function resolveCopilotPrompt(
  id: CopilotPromptId,
  t: (key: string) => string,
  prefs: CopilotPromptPrefsV1 = readCopilotPromptPrefs()
): string {
  const custom = prefs[id]?.trim()
  if (custom) return custom
  return t(COPILOT_PROMPT_DEFAULT_I18N_KEY[id])
}

/** Live-Prefs (Settings-Änderungen ohne Reload). */
export function useCopilotPromptPrefs(): CopilotPromptPrefsV1 {
  const [prefs, setPrefs] = useState<CopilotPromptPrefsV1>(() => readCopilotPromptPrefs())
  useEffect(() => {
    const onChange = (): void => setPrefs(readCopilotPromptPrefs())
    window.addEventListener(COPILOT_PROMPT_PREFS_CHANGED_EVENT, onChange)
    return (): void => window.removeEventListener(COPILOT_PROMPT_PREFS_CHANGED_EVENT, onChange)
  }, [])
  return prefs
}

export function useResolvedCopilotPrompt(id: CopilotPromptId): string {
  const { t } = useTranslation()
  const prefs = useCopilotPromptPrefs()
  return resolveCopilotPrompt(id, t, prefs)
}
