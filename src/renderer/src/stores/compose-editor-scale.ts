import { create } from 'zustand'

const STORAGE_KEY = 'mailclient.composeEditorScale.v1'

export const COMPOSE_EDITOR_SCALE_MIN = 0.75
export const COMPOSE_EDITOR_SCALE_MAX = 2
export const COMPOSE_EDITOR_SCALE_STEP = 0.1
export const COMPOSE_EDITOR_SCALE_DEFAULT = 1

function clampComposeEditorScale(value: number): number {
  if (!Number.isFinite(value)) return COMPOSE_EDITOR_SCALE_DEFAULT
  return Math.min(COMPOSE_EDITOR_SCALE_MAX, Math.max(COMPOSE_EDITOR_SCALE_MIN, value))
}

function readStoredComposeEditorScale(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return COMPOSE_EDITOR_SCALE_DEFAULT
    return clampComposeEditorScale(Number.parseFloat(raw))
  } catch {
    return COMPOSE_EDITOR_SCALE_DEFAULT
  }
}

function persistComposeEditorScale(scale: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    // ignore
  }
}

const initialScale = readStoredComposeEditorScale()

interface ComposeEditorScaleState {
  scale: number
  setScale: (scale: number) => void
  stepScale: (delta: number) => void
  resetScale: () => void
}

export const useComposeEditorScaleStore = create<ComposeEditorScaleState>((set, get) => ({
  scale: initialScale,

  setScale(scale): void {
    const next = clampComposeEditorScale(scale)
    persistComposeEditorScale(next)
    set({ scale: next })
  },

  stepScale(delta): void {
    const cur = get().scale
    const stepped =
      Math.round((cur + delta) / COMPOSE_EDITOR_SCALE_STEP) * COMPOSE_EDITOR_SCALE_STEP
    get().setScale(stepped)
  },

  resetScale(): void {
    get().setScale(COMPOSE_EDITOR_SCALE_DEFAULT)
  }
}))

export function composeEditorScalePercent(scale: number): number {
  return Math.round(scale * 100)
}
