import { create } from 'zustand'

const STORAGE_KEY = 'mailclient.uiScale.v1'

export const UI_SCALE_MIN = 0.65
export const UI_SCALE_MAX = 1.35
export const UI_SCALE_STEP = 0.05
export const UI_SCALE_DEFAULT = 1

export const UI_SCALE_PRESETS = [
  0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.25, 1.35
] as const

function clampUiScale(value: number): number {
  if (!Number.isFinite(value)) return UI_SCALE_DEFAULT
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value))
}

function readStoredUiScale(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return UI_SCALE_DEFAULT
    const n = Number.parseFloat(raw)
    return clampUiScale(n)
  } catch {
    return UI_SCALE_DEFAULT
  }
}

function persistUiScale(scale: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    // ignore
  }
}

/**
 * Gesamte App-Oberfläche (Chromium-zoom auf html).
 * Skaliert rem, px und feste Tailwind-Größen gleichermaßen.
 *
 * Getrennt davon: Mail-Vorschau-Zoom (`useMailPreviewScaleStore`, style.zoom am Shadow-Host)
 * und Editor-Zoom im Composer (`useComposeEditorScaleStore`).
 */
function applyUiScale(scale: number): void {
  const root = document.documentElement
  root.style.setProperty('--ui-scale', String(scale))
  if (scale === UI_SCALE_DEFAULT) {
    root.style.zoom = ''
    root.style.fontSize = ''
  } else {
    root.style.fontSize = ''
    root.style.zoom = String(scale)
  }
}

const initialScale = readStoredUiScale()
applyUiScale(initialScale)

interface UiScaleState {
  scale: number
  setScale: (scale: number) => void
  stepScale: (delta: number) => void
  resetScale: () => void
}

export const useUiScaleStore = create<UiScaleState>((set, get) => ({
  scale: initialScale,

  setScale(scale): void {
    const next = clampUiScale(scale)
    persistUiScale(next)
    applyUiScale(next)
    set({ scale: next })
  },

  stepScale(delta): void {
    const cur = get().scale
    const stepped = Math.round((cur + delta) / UI_SCALE_STEP) * UI_SCALE_STEP
    get().setScale(stepped)
  },

  resetScale(): void {
    get().setScale(UI_SCALE_DEFAULT)
  }
}))

export function uiScalePercent(scale: number): number {
  return Math.round(scale * 100)
}
