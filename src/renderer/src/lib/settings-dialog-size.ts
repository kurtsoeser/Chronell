export const SETTINGS_DIALOG_SIZE_STORAGE_KEY = 'chronell:settings-dialog-size-v1'

export const SETTINGS_DIALOG_DEFAULT_WIDTH = 1040
export const SETTINGS_DIALOG_DEFAULT_HEIGHT = 680
export const SETTINGS_DIALOG_MIN_WIDTH = 760
export const SETTINGS_DIALOG_MIN_HEIGHT = 480
export const SETTINGS_DIALOG_MAX_WIDTH = 1280
export const SETTINGS_DIALOG_MAX_HEIGHT_CAP = 920

export interface SettingsDialogSize {
  width: number
  height: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function settingsDialogViewportLimits(): {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
} {
  if (typeof window === 'undefined') {
    return {
      minWidth: SETTINGS_DIALOG_MIN_WIDTH,
      minHeight: SETTINGS_DIALOG_MIN_HEIGHT,
      maxWidth: SETTINGS_DIALOG_MAX_WIDTH,
      maxHeight: SETTINGS_DIALOG_MAX_HEIGHT_CAP
    }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    minWidth: SETTINGS_DIALOG_MIN_WIDTH,
    minHeight: SETTINGS_DIALOG_MIN_HEIGHT,
    maxWidth: Math.min(SETTINGS_DIALOG_MAX_WIDTH, vw - 32),
    maxHeight: Math.min(SETTINGS_DIALOG_MAX_HEIGHT_CAP, Math.round(vh * 0.92), vh - 32)
  }
}

export function clampSettingsDialogSize(size: SettingsDialogSize): SettingsDialogSize {
  const limits = settingsDialogViewportLimits()
  return {
    width: clamp(size.width, limits.minWidth, limits.maxWidth),
    height: clamp(size.height, limits.minHeight, limits.maxHeight)
  }
}

export function readStoredSettingsDialogSize(): SettingsDialogSize {
  try {
    const raw = window.localStorage.getItem(SETTINGS_DIALOG_SIZE_STORAGE_KEY)
    if (!raw) return clampSettingsDialogSize({
      width: SETTINGS_DIALOG_DEFAULT_WIDTH,
      height: SETTINGS_DIALOG_DEFAULT_HEIGHT
    })
    const p = JSON.parse(raw) as { width?: unknown; height?: unknown; w?: unknown; h?: unknown }
    const width =
      typeof p.width === 'number'
        ? p.width
        : typeof p.w === 'number'
          ? p.w
          : SETTINGS_DIALOG_DEFAULT_WIDTH
    const height =
      typeof p.height === 'number'
        ? p.height
        : typeof p.h === 'number'
          ? p.h
          : SETTINGS_DIALOG_DEFAULT_HEIGHT
    return clampSettingsDialogSize({
      width: Number.isFinite(width) ? width : SETTINGS_DIALOG_DEFAULT_WIDTH,
      height: Number.isFinite(height) ? height : SETTINGS_DIALOG_DEFAULT_HEIGHT
    })
  } catch {
    return clampSettingsDialogSize({
      width: SETTINGS_DIALOG_DEFAULT_WIDTH,
      height: SETTINGS_DIALOG_DEFAULT_HEIGHT
    })
  }
}

export function writeStoredSettingsDialogSize(size: SettingsDialogSize): void {
  try {
    const clamped = clampSettingsDialogSize(size)
    window.localStorage.setItem(
      SETTINGS_DIALOG_SIZE_STORAGE_KEY,
      JSON.stringify({
        width: Math.round(clamped.width),
        height: Math.round(clamped.height)
      })
    )
  } catch {
    // ignore
  }
}
