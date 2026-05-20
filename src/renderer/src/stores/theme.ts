import { create } from 'zustand'

import {
  DARK_PALETTE_EXTRA_CSS_VARS,
  DARK_PALETTE_EXTRA_VAR_NAMES,
  DARK_PALETTE_SURFACES
} from '@/lib/dark-palette-presets'
import {
  DEFAULT_LIGHT_PALETTE,
  LIGHT_PALETTE_SURFACES,
  type LightPalette as LightPaletteId
} from '@/lib/light-palette-presets'
import { findBuiltinColorPreset, isBuiltinColorPresetId } from '@/lib/theme-color-presets-builtin'
import { DEFAULT_SURFACE_HEX } from '@/lib/theme-default-surfaces'
import { hexToHslTriplet, mixFlatSurfaceHex, normalizeHex } from '@/lib/theme-color-utils'

export type ThemeMode = 'system' | 'light' | 'dark'
export type EffectiveTheme = 'light' | 'dark'

export type PaletteVariantId = 'default' | 'midnight' | 'nord' | 'graphite'

export type DarkPalette = PaletteVariantId
export type LightPalette = LightPaletteId

/** Standard-Dunkel-Variante (neutrales Graphit). */
export const DEFAULT_DARK_PALETTE: DarkPalette = 'graphite'

export { DEFAULT_LIGHT_PALETTE } from '@/lib/light-palette-presets'

export type ThemeSurfaceToken = 'background' | 'sidebar' | 'card' | 'muted'

export type ThemeSurfaceColors = Partial<Record<ThemeSurfaceToken, string>>

export type CustomThemeColors = Record<EffectiveTheme, ThemeSurfaceColors>

/** Vollstaendiger Farbsatz pro Modus (fuer Presets). */
export type ThemeColorPresetSnapshot = Record<EffectiveTheme, Record<ThemeSurfaceToken, string>>

export interface ThemeColorPreset {
  id: string
  name: string
  /** Nur dieses Schema wird beim Anwenden gesetzt; fehlt = Hell+Dunkel (eigene Presets). */
  schema?: EffectiveTheme
  colors: ThemeColorPresetSnapshot
  createdAt: string
}

export function presetAppliesToSchema(preset: ThemeColorPreset): EffectiveTheme | 'both' {
  if (preset.schema === 'light' || preset.schema === 'dark') return preset.schema
  return 'both'
}

export function isColorPresetActive(
  preset: ThemeColorPreset,
  resolvedLight: Record<ThemeSurfaceToken, string>,
  resolvedDark: Record<ThemeSurfaceToken, string>
): boolean {
  const target = presetAppliesToSchema(preset)
  if (target === 'light') return matchesSurfaceSet(resolvedLight, preset.colors.light)
  if (target === 'dark') return matchesSurfaceSet(resolvedDark, preset.colors.dark)
  return (
    matchesSurfaceSet(resolvedLight, preset.colors.light) &&
    matchesSurfaceSet(resolvedDark, preset.colors.dark)
  )
}

function matchesSurfaceSet(
  resolved: Record<ThemeSurfaceToken, string>,
  presetLayers: Record<ThemeSurfaceToken, string>
): boolean {
  return SURFACE_TOKEN_LIST.every((t) => resolved[t].toLowerCase() === presetLayers[t].toLowerCase())
}

function customColorsForPreset(
  preset: ThemeColorPreset,
  current: CustomThemeColors
): CustomThemeColors {
  const target = presetAppliesToSchema(preset)
  if (target === 'both') return snapshotToCustomColors(preset.colors)

  const next: CustomThemeColors = {
    light: { ...current.light },
    dark: { ...current.dark }
  }
  const overrides: ThemeSurfaceColors = {}
  for (const token of SURFACE_TOKEN_LIST) {
    const hex = normalizeHex(preset.colors[target][token])
    if (hex && hex !== DEFAULT_SURFACE_HEX[target][token]) overrides[token] = hex
  }
  next[target] = overrides
  return next
}

export const SURFACE_TOKEN_LIST: ThemeSurfaceToken[] = ['background', 'sidebar', 'card', 'muted']

const MAX_THEME_COLOR_PRESETS = 24

const SURFACE_CSS_VARS: Record<ThemeSurfaceToken, string> = {
  background: '--background',
  sidebar: '--sidebar',
  card: '--card',
  muted: '--muted'
}

export { DEFAULT_SURFACE_HEX } from '@/lib/theme-default-surfaces'

export type AccentName =
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'slate'

const STORAGE_MODE_KEY = 'mailclient.theme'
const STORAGE_ACCENT_KEY = 'mailclient.themeAccent'
const STORAGE_DARK_PALETTE = 'mailclient.darkPalette'
const STORAGE_LIGHT_PALETTE = 'mailclient.lightPalette'
const STORAGE_CUSTOM_COLORS = 'mailclient.themeColors.v1'
const STORAGE_COLOR_PRESETS = 'mailclient.themeColorPresets.v1'

const PALETTE_CLASSES = ['palette-midnight', 'palette-nord', 'palette-graphite'] as const

/**
 * HSL-Werte fuer die acht waehlbaren Akzentfarben. Funktionieren in
 * beiden Themes (Light/Dark) ausreichend, kleine Helligkeits-Anpassung
 * koennte spaeter pro Theme erfolgen.
 */
const ACCENT_HSL: Record<AccentName, string> = {
  blue: '217 91% 60%',
  indigo: '235 75% 65%',
  violet: '262 70% 65%',
  pink: '330 75% 62%',
  rose: '350 75% 60%',
  amber: '32 92% 55%',
  emerald: '152 60% 48%',
  slate: '215 12% 55%'
}

export const ACCENT_LIST: { id: AccentName; label: string }[] = [
  { id: 'blue', label: 'Blau' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'violet', label: 'Violett' },
  { id: 'pink', label: 'Pink' },
  { id: 'rose', label: 'Rosé' },
  { id: 'amber', label: 'Bernstein' },
  { id: 'emerald', label: 'Smaragd' },
  { id: 'slate', label: 'Schiefer' }
]

export function accentHsl(name: AccentName): string {
  return ACCENT_HSL[name]
}

/** Gleiche Flaeche wie `.chronell-surface-flat` (Mailliste, Lesebereich). */
export function resolveMailViewerDarkSurfaceHex(
  darkPalette: DarkPalette,
  customDark: ThemeSurfaceColors
): string {
  const surfaces = resolveSurfaceHex('dark', customDark, darkPalette)
  return mixFlatSurfaceHex(surfaces.card, surfaces.background)
}

interface ThemeState {
  mode: ThemeMode
  effective: EffectiveTheme
  accent: AccentName
  darkPalette: DarkPalette
  lightPalette: LightPalette
  customColors: CustomThemeColors
  colorPresets: ThemeColorPreset[]

  setMode: (mode: ThemeMode) => void
  setAccent: (accent: AccentName) => void
  setDarkPalette: (palette: DarkPalette) => void
  setLightPalette: (palette: LightPalette) => void
  /** Dunkel-Variante wählen und eigene Dunkel-Layers zurücksetzen. */
  applyDarkPaletteVariant: (palette: DarkPalette) => void
  /** Hell-Variante wählen und eigene Hell-Layers zurücksetzen. */
  applyLightPaletteVariant: (palette: LightPalette) => void
  setSurfaceColor: (theme: EffectiveTheme, token: ThemeSurfaceToken, hex: string | null) => void
  resetSurfaceColors: (theme: EffectiveTheme) => void
  saveColorPreset: (name: string) => { ok: true; id: string } | { ok: false; reason: 'empty' | 'limit' }
  applyColorPreset: (id: string) => void
  deleteColorPreset: (id: string) => void

  /**
   * Liest die OS-Praeferenz und persistiert nichts. Wird beim Start und
   * bei OS-Theme-Wechseln aufgerufen, sofern `mode === 'system'`.
   */
  syncFromSystem: () => void
}

/** Aktuelle Hex-Werte inkl. Palette-/Standard-Fallbacks. */
export function resolveSurfaceHex(
  theme: EffectiveTheme,
  customColors: ThemeSurfaceColors,
  darkPalette: DarkPalette = DEFAULT_DARK_PALETTE,
  lightPalette: LightPalette = DEFAULT_LIGHT_PALETTE
): Record<ThemeSurfaceToken, string> {
  const base =
    theme === 'dark'
      ? { ...DARK_PALETTE_SURFACES[darkPalette] }
      : { ...LIGHT_PALETTE_SURFACES[lightPalette] }
  const result = base
  for (const token of SURFACE_TOKEN_LIST) {
    const hex = customColors[token]
    if (hex) result[token] = hex
  }
  return result
}

export function buildColorPresetSnapshot(
  customColors: CustomThemeColors,
  darkPalette: DarkPalette = DEFAULT_DARK_PALETTE,
  lightPalette: LightPalette = DEFAULT_LIGHT_PALETTE
): ThemeColorPresetSnapshot {
  return {
    light: resolveSurfaceHex('light', customColors.light, darkPalette, lightPalette),
    dark: resolveSurfaceHex('dark', customColors.dark, darkPalette, lightPalette)
  }
}

function snapshotToCustomColors(snapshot: ThemeColorPresetSnapshot): CustomThemeColors {
  const light: ThemeSurfaceColors = {}
  const dark: ThemeSurfaceColors = {}
  for (const token of SURFACE_TOKEN_LIST) {
    const lightHex = normalizeHex(snapshot.light[token])
    const darkHex = normalizeHex(snapshot.dark[token])
    if (lightHex && lightHex !== DEFAULT_SURFACE_HEX.light[token]) light[token] = lightHex
    if (darkHex && darkHex !== DEFAULT_SURFACE_HEX.dark[token]) dark[token] = darkHex
  }
  return { light, dark }
}

function readStoredMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(STORAGE_MODE_KEY)
    if (v === 'system' || v === 'light' || v === 'dark') return v
  } catch {
    // localStorage nicht verfuegbar (z.B. private mode) – Default
  }
  return 'system'
}

function readStoredPaletteVariant(storageKey: string, fallback: PaletteVariantId): PaletteVariantId {
  try {
    const v = window.localStorage.getItem(storageKey) as PaletteVariantId | null
    if (v === 'midnight' || v === 'nord' || v === 'graphite' || v === 'default') return v
  } catch {
    // ignore
  }
  return fallback
}

function readStoredDarkPalette(): DarkPalette {
  return readStoredPaletteVariant(STORAGE_DARK_PALETTE, DEFAULT_DARK_PALETTE)
}

function readStoredLightPalette(): LightPalette {
  return readStoredPaletteVariant(STORAGE_LIGHT_PALETTE, DEFAULT_LIGHT_PALETTE)
}

function persistDarkPalette(palette: DarkPalette): void {
  try {
    window.localStorage.setItem(STORAGE_DARK_PALETTE, palette)
  } catch {
    // ignore
  }
}

function persistLightPalette(palette: LightPalette): void {
  try {
    window.localStorage.setItem(STORAGE_LIGHT_PALETTE, palette)
  } catch {
    // ignore
  }
}

function applyDarkPaletteClasses(effective: EffectiveTheme, palette: DarkPalette): void {
  const root = document.documentElement
  for (const c of PALETTE_CLASSES) root.classList.remove(c)
  if (effective !== 'dark' || palette === 'default') return
  if (palette === 'midnight') root.classList.add('palette-midnight')
  if (palette === 'nord') root.classList.add('palette-nord')
  if (palette === 'graphite') root.classList.add('palette-graphite')
}

function readStoredAccent(): AccentName {
  try {
    const v = window.localStorage.getItem(STORAGE_ACCENT_KEY) as AccentName | null
    if (v && v in ACCENT_HSL) return v
  } catch {
    // ignore
  }
  return 'blue'
}

function persistMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_MODE_KEY, mode)
  } catch {
    // ignore
  }
}

function persistAccent(accent: AccentName): void {
  try {
    window.localStorage.setItem(STORAGE_ACCENT_KEY, accent)
  } catch {
    // ignore
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

function resolveEffective(mode: ThemeMode): EffectiveTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function readStoredCustomColors(): CustomThemeColors {
  const empty: CustomThemeColors = { light: {}, dark: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_CUSTOM_COLORS)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<CustomThemeColors>
    const result: CustomThemeColors = { light: {}, dark: {} }
    for (const theme of ['light', 'dark'] as const) {
      const source = parsed[theme]
      if (!source || typeof source !== 'object') continue
      for (const token of SURFACE_TOKEN_LIST) {
        const hex = source[token]
        if (typeof hex === 'string') {
          const normalized = normalizeHex(hex)
          if (normalized) result[theme][token] = normalized
        }
      }
    }
    return result
  } catch {
    return empty
  }
}

function persistCustomColors(colors: CustomThemeColors): void {
  try {
    window.localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(colors))
  } catch {
    // ignore
  }
}

function readStoredColorPresets(): ThemeColorPreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_COLOR_PRESETS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const result: ThemeColorPreset[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const row = item as Partial<ThemeColorPreset>
      if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.colors) continue
      const colors = row.colors as Partial<ThemeColorPresetSnapshot>
      const light = colors.light
      const dark = colors.dark
      if (!light || !dark || typeof light !== 'object' || typeof dark !== 'object') continue
      const snapshot: ThemeColorPresetSnapshot = {
        light: { ...DEFAULT_SURFACE_HEX.light },
        dark: { ...DEFAULT_SURFACE_HEX.dark }
      }
      let valid = true
      for (const theme of ['light', 'dark'] as const) {
        for (const token of SURFACE_TOKEN_LIST) {
          const hex = normalizeHex(String(colors[theme]?.[token] ?? ''))
          if (!hex) {
            valid = false
            break
          }
          snapshot[theme][token] = hex
        }
        if (!valid) break
      }
      if (!valid) continue
      const schema =
        row.schema === 'light' || row.schema === 'dark' ? row.schema : undefined
      result.push({
        id: row.id,
        name: row.name.trim().slice(0, 48) || 'Preset',
        schema,
        colors: snapshot,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString()
      })
    }
    return result.slice(0, MAX_THEME_COLOR_PRESETS)
  } catch {
    return []
  }
}

function persistColorPresets(presets: ThemeColorPreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_COLOR_PRESETS, JSON.stringify(presets))
  } catch {
    // ignore
  }
}

function applyCustomColorsState(
  colors: CustomThemeColors,
  effective: EffectiveTheme,
  darkPalette: DarkPalette,
  lightPalette: LightPalette
): void {
  persistCustomColors(colors)
  applySurfaceColors(effective, darkPalette, lightPalette, colors)
}

function clearSurfaceInlineStyles(): void {
  const root = document.documentElement
  for (const token of SURFACE_TOKEN_LIST) {
    root.style.removeProperty(SURFACE_CSS_VARS[token])
  }
  for (const name of DARK_PALETTE_EXTRA_VAR_NAMES) {
    root.style.removeProperty(name)
  }
}

function applyDarkPaletteExtras(palette: DarkPalette): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(DARK_PALETTE_EXTRA_CSS_VARS[palette])) {
    root.style.setProperty(name, value)
  }
}

function applySurfaceColors(
  effective: EffectiveTheme,
  darkPalette: DarkPalette,
  lightPalette: LightPalette,
  colors: CustomThemeColors
): void {
  clearSurfaceInlineStyles()
  const root = document.documentElement

  if (effective === 'dark') {
    const base = DARK_PALETTE_SURFACES[darkPalette]
    const overrides = colors.dark
    for (const token of SURFACE_TOKEN_LIST) {
      const hex = overrides[token] ?? base[token]
      root.style.setProperty(SURFACE_CSS_VARS[token], hexToHslTriplet(hex))
    }
    applyDarkPaletteExtras(darkPalette)
    return
  }

  const base = LIGHT_PALETTE_SURFACES[lightPalette]
  const overrides = colors.light
  for (const token of SURFACE_TOKEN_LIST) {
    const hex = overrides[token] ?? base[token]
    root.style.setProperty(SURFACE_CSS_VARS[token], hexToHslTriplet(hex))
  }
}

function applyTheme(
  theme: EffectiveTheme,
  darkPalette: DarkPalette,
  lightPalette: LightPalette,
  customColors: CustomThemeColors
): void {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = theme
  applyDarkPaletteClasses(theme, darkPalette)
  applySurfaceColors(theme, darkPalette, lightPalette, customColors)
}

function applyAccent(name: AccentName): void {
  const root = document.documentElement
  const hsl = ACCENT_HSL[name]
  // Wir ueberschreiben sowohl --primary (Buttons, aktive Modes) als
  // auch --ring (Focus-Outline) und --status-unread (Ungelesen-Dot +
  // Mail-Item-Akzent), damit die Akzentfarbe in der gesamten UI greift.
  root.style.setProperty('--primary', hsl)
  root.style.setProperty('--ring', hsl)
  root.style.setProperty('--status-unread', hsl)
}

const initialMode = readStoredMode()
const initialEffective = resolveEffective(initialMode)
const initialAccent = readStoredAccent()
const initialDarkPalette = readStoredDarkPalette()
const initialLightPalette = readStoredLightPalette()
const initialCustomColors = readStoredCustomColors()
const initialColorPresets = readStoredColorPresets()
applyTheme(initialEffective, initialDarkPalette, initialLightPalette, initialCustomColors)
applyAccent(initialAccent)

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  effective: initialEffective,
  accent: initialAccent,
  darkPalette: initialDarkPalette,
  lightPalette: initialLightPalette,
  customColors: initialCustomColors,
  colorPresets: initialColorPresets,

  setMode(mode): void {
    persistMode(mode)
    const effective = resolveEffective(mode)
    applyTheme(effective, get().darkPalette, get().lightPalette, get().customColors)
    set({ mode, effective })
  },

  setAccent(accent): void {
    persistAccent(accent)
    applyAccent(accent)
    set({ accent })
  },

  setDarkPalette(palette): void {
    persistDarkPalette(palette)
    applyTheme(get().effective, palette, get().lightPalette, get().customColors)
    set({ darkPalette: palette })
  },

  setLightPalette(palette): void {
    persistLightPalette(palette)
    applyTheme(get().effective, get().darkPalette, palette, get().customColors)
    set({ lightPalette: palette })
  },

  applyDarkPaletteVariant(palette): void {
    persistDarkPalette(palette)
    const next: CustomThemeColors = {
      light: { ...get().customColors.light },
      dark: {}
    }
    persistCustomColors(next)
    applyTheme(get().effective, palette, get().lightPalette, next)
    set({ darkPalette: palette, customColors: next })
  },

  applyLightPaletteVariant(palette): void {
    persistLightPalette(palette)
    const next: CustomThemeColors = {
      light: {},
      dark: { ...get().customColors.dark }
    }
    persistCustomColors(next)
    applyTheme(get().effective, get().darkPalette, palette, next)
    set({ lightPalette: palette, customColors: next })
  },

  setSurfaceColor(theme, token, hex): void {
    const next: CustomThemeColors = {
      light: { ...get().customColors.light },
      dark: { ...get().customColors.dark }
    }
    if (hex == null) {
      delete next[theme][token]
    } else {
      const normalized = normalizeHex(hex)
      if (!normalized) return
      next[theme][token] = normalized
    }
    persistCustomColors(next)
    if (get().effective === theme) {
      applySurfaceColors(theme, get().darkPalette, get().lightPalette, next)
    }
    set({ customColors: next })
  },

  resetSurfaceColors(theme): void {
    const next: CustomThemeColors = {
      light: { ...get().customColors.light },
      dark: { ...get().customColors.dark }
    }
    next[theme] = {}
    applyCustomColorsState(next, get().effective, get().darkPalette, get().lightPalette)
    set({ customColors: next })
  },

  saveColorPreset(name): { ok: true; id: string } | { ok: false; reason: 'empty' | 'limit' } {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, reason: 'empty' }
    const presets = get().colorPresets
    if (presets.length >= MAX_THEME_COLOR_PRESETS) return { ok: false, reason: 'limit' }

    const preset: ThemeColorPreset = {
      id: crypto.randomUUID(),
      name: trimmed.slice(0, 48),
      colors: buildColorPresetSnapshot(
        get().customColors,
        get().darkPalette,
        get().lightPalette
      ),
      createdAt: new Date().toISOString()
    }
    const next = [...presets, preset]
    persistColorPresets(next)
    set({ colorPresets: next })
    return { ok: true, id: preset.id }
  },

  applyColorPreset(id): void {
    const preset = get().colorPresets.find((p) => p.id === id) ?? findBuiltinColorPreset(id)
    if (!preset) return
    const next = customColorsForPreset(preset, get().customColors)
    applyCustomColorsState(next, get().effective, get().darkPalette, get().lightPalette)
    set({ customColors: next })
  },

  deleteColorPreset(id): void {
    if (isBuiltinColorPresetId(id)) return
    const next = get().colorPresets.filter((p) => p.id !== id)
    persistColorPresets(next)
    set({ colorPresets: next })
  },

  syncFromSystem(): void {
    if (get().mode !== 'system') return
    const effective = resolveEffective('system')
    applyTheme(effective, get().darkPalette, get().lightPalette, get().customColors)
    set({ effective })
  }
}))

/**
 * Listener fuer OS-Theme-Wechsel registrieren. Wird einmal beim
 * Module-Load aufgerufen – `matchMedia` haelt den Listener am Leben,
 * solange das Fenster existiert.
 */
function installSystemListener(): void {
  if (!window.matchMedia) return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (): void => useThemeStore.getState().syncFromSystem()
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler)
  } else {
    // Aelteres Safari-API
    const legacy = mq as unknown as {
      addListener?: (h: (e: MediaQueryListEvent) => void) => void
    }
    if (typeof legacy.addListener === 'function') legacy.addListener(handler)
  }
}

installSystemListener()
