import { create } from 'zustand'

const STORAGE_KEY = 'mailclient.mailPreviewScale.v1'

export const MAIL_PREVIEW_SCALE_MIN = 0.75
export const MAIL_PREVIEW_SCALE_MAX = 2
export const MAIL_PREVIEW_SCALE_STEP = 0.1
export const MAIL_PREVIEW_SCALE_DEFAULT = 1

export const MAIL_PREVIEW_SCALE_PRESETS = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75, 2] as const

function clampMailPreviewScale(value: number): number {
  if (!Number.isFinite(value)) return MAIL_PREVIEW_SCALE_DEFAULT
  return Math.min(MAIL_PREVIEW_SCALE_MAX, Math.max(MAIL_PREVIEW_SCALE_MIN, value))
}

function readStoredMailPreviewScale(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return MAIL_PREVIEW_SCALE_DEFAULT
    const n = Number.parseFloat(raw)
    return clampMailPreviewScale(n)
  } catch {
    return MAIL_PREVIEW_SCALE_DEFAULT
  }
}

function persistMailPreviewScale(scale: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    // ignore
  }
}

const initialScale = readStoredMailPreviewScale()

interface MailPreviewScaleState {
  scale: number
  setScale: (scale: number) => void
  stepScale: (delta: number) => void
  resetScale: () => void
}

export const useMailPreviewScaleStore = create<MailPreviewScaleState>((set, get) => ({
  scale: initialScale,

  setScale(scale): void {
    const next = clampMailPreviewScale(scale)
    persistMailPreviewScale(next)
    set({ scale: next })
  },

  stepScale(delta): void {
    const cur = get().scale
    const stepped = Math.round((cur + delta) / MAIL_PREVIEW_SCALE_STEP) * MAIL_PREVIEW_SCALE_STEP
    get().setScale(stepped)
  },

  resetScale(): void {
    get().setScale(MAIL_PREVIEW_SCALE_DEFAULT)
  }
}))

export function mailPreviewScalePercent(scale: number): number {
  return Math.round(scale * 100)
}
