import { create } from 'zustand'

import { useThemeStore, type EffectiveTheme } from '@/stores/theme'

const STORAGE_KEY = 'mailclient.composeEditorTheme.v1'

export type ComposeEditorTheme = EffectiveTheme

function readStoredPreference(): ComposeEditorTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // ignore
  }
  return null
}

function persistPreference(value: ComposeEditorTheme | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

interface ComposeEditorThemeState {
  /** `null` = App-Hell/Dunkel übernehmen. */
  preference: ComposeEditorTheme | null
  setPreference: (theme: ComposeEditorTheme | null) => void
  toggle: () => void
}

export const useComposeEditorThemeStore = create<ComposeEditorThemeState>((set, get) => ({
  preference: readStoredPreference(),

  setPreference(theme): void {
    persistPreference(theme)
    set({ preference: theme })
  },

  toggle(): void {
    const app = useThemeStore.getState().effective
    const current = get().preference ?? app
    get().setPreference(current === 'light' ? 'dark' : 'light')
  }
}))

/** Effektives Editor-Schema (eigene Wahl oder App-Theme). */
export function useComposeEditorEffectiveTheme(): ComposeEditorTheme {
  const preference = useComposeEditorThemeStore((s) => s.preference)
  const appEffective = useThemeStore((s) => s.effective)
  return preference ?? appEffective
}
