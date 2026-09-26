/**
 * Globale Standard-KI-Engine für Assist/Compose (lokal).
 * `null` = automatische Wahl (MS → Graph, sonst erste API).
 */

import { useEffect, useState } from 'react'
import {
  normalizeCopilotChatEngine,
  type CopilotChatEngine
} from '@shared/types'

export const COPILOT_DEFAULT_ENGINE_CHANGED_EVENT =
  'mailclient:copilot-default-engine-changed'

const STORAGE_KEY = 'mailclient.copilot.defaultEngine.v1'

export function readDefaultCopilotEnginePref(): CopilotChatEngine | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)?.trim()
    if (!raw || raw === 'auto') return null
    return normalizeCopilotChatEngine(raw)
  } catch {
    return null
  }
}

export function persistDefaultCopilotEnginePref(engine: CopilotChatEngine | null): void {
  try {
    if (!engine) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, engine)
    }
    window.dispatchEvent(new CustomEvent(COPILOT_DEFAULT_ENGINE_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function useDefaultCopilotEnginePref(): CopilotChatEngine | null {
  const [pref, setPref] = useState<CopilotChatEngine | null>(() =>
    readDefaultCopilotEnginePref()
  )
  useEffect(() => {
    const onChange = (): void => setPref(readDefaultCopilotEnginePref())
    window.addEventListener(COPILOT_DEFAULT_ENGINE_CHANGED_EVENT, onChange)
    return (): void => window.removeEventListener(COPILOT_DEFAULT_ENGINE_CHANGED_EVENT, onChange)
  }, [])
  return pref
}
