import { DEFAULT_SURFACE_HEX } from '@/lib/theme-default-surfaces'
import type {
  EffectiveTheme,
  ThemeColorPreset,
  ThemeColorPresetSnapshot,
  ThemeSurfaceToken
} from '@/stores/theme'

export const BUILTIN_COLOR_PRESET_PREFIX = 'builtin:'

type SurfaceSet = Record<ThemeSurfaceToken, string>

function layers(
  background: string,
  sidebar: string,
  card: string,
  muted: string
): SurfaceSet {
  return { background, sidebar, card, muted }
}

function snapshotForSchema(schema: EffectiveTheme, colors: SurfaceSet): ThemeColorPresetSnapshot {
  return {
    light: schema === 'light' ? colors : { ...DEFAULT_SURFACE_HEX.light },
    dark: schema === 'dark' ? colors : { ...DEFAULT_SURFACE_HEX.dark }
  }
}

function builtinSurface(
  schema: EffectiveTheme,
  id: string,
  name: string,
  colors: SurfaceSet
): ThemeColorPreset {
  return {
    id: `${BUILTIN_COLOR_PRESET_PREFIX}${id}`,
    name,
    schema,
    colors: snapshotForSchema(schema, colors),
    createdAt: '1970-01-01T00:00:00.000Z'
  }
}

/** 24 Oberflaechen-Presets: 12 hell, 12 dunkel (je ein Schema, L0–L3). */
export const BUILTIN_THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  // —— Hell (12) ——
  builtinSurface('light', 'fluent-light', 'Fluent Light', layers('#f6f7fa', '#e9ecf2', '#ffffff', '#e5e9f1')),
  builtinSurface('light', 'warm-paper', 'Warm Paper', layers('#f7f4ef', '#ebe6dc', '#fffdf9', '#e3ddd2')),
  builtinSurface('light', 'nord-snow', 'Nord Snow', layers('#eceff4', '#e5e9f0', '#f4f6fb', '#d8dee9')),
  builtinSurface('light', 'cool-slate', 'Cool Slate', layers('#f1f5f9', '#e2e8f0', '#ffffff', '#cbd5e1')),
  builtinSurface('light', 'github-light', 'GitHub Light', layers('#ffffff', '#f6f8fa', '#ffffff', '#d8dee4')),
  builtinSurface('light', 'sage-morning', 'Sage Morning', layers('#f2f7f4', '#e3ece6', '#fafcfb', '#d4e4d9')),
  builtinSurface('light', 'office-white', 'Office White', layers('#fafbfc', '#eef1f5', '#ffffff', '#e4e8ef')),
  builtinSurface('light', 'pearl', 'Pearl', layers('#f8f9fb', '#eceff4', '#ffffff', '#dfe4ec')),
  builtinSurface('light', 'linen', 'Linen', layers('#f9f6f1', '#efe9df', '#fffcf7', '#e5ddd0')),
  builtinSurface('light', 'arctic', 'Arctic', layers('#eef6fc', '#dceaf5', '#ffffff', '#c5d9eb')),
  builtinSurface('light', 'rose-mist', 'Rose Mist', layers('#faf5f6', '#f0e6e9', '#ffffff', '#e8d4da')),
  builtinSurface('light', 'mint-frost', 'Mint Frost', layers('#f0faf5', '#dff3ea', '#f8fffb', '#cae8d8')),

  // —— Dunkel (12) ——
  builtinSurface('dark', 'graphite', 'Graphite', layers('#121212', '#1a1a1a', '#242424', '#363636')),
  builtinSurface('dark', 'carbon', 'Carbon', layers('#121212', '#242424', '#404040', '#616161')),
  builtinSurface('dark', 'github-dark', 'GitHub Dark', layers('#0d1117', '#161b22', '#21262d', '#30363d')),
  builtinSurface('dark', 'midnight-ocean', 'Midnight Ocean', layers('#0b1120', '#0f172a', '#1e293b', '#243347')),
  builtinSurface('dark', 'nord-night', 'Nord Night', layers('#2e3440', '#3b4252', '#434c5e', '#4c566a')),
  builtinSurface('dark', 'material-dark', 'Material Dark', layers('#121212', '#1f1f1f', '#333333', '#404040')),
  builtinSurface('dark', 'deep-night', 'Deep Night', layers('#11111b', '#181825', '#313244', '#45475a')),
  builtinSurface('dark', 'charcoal', 'Charcoal', layers('#1c1c1e', '#2c2c2e', '#3a3a3c', '#48484a')),
  builtinSurface('dark', 'slate-blue', 'Slate Blue', layers('#0f172a', '#1e293b', '#334155', '#475569')),
  builtinSurface('dark', 'zinc-dark', 'Zinc Dark', layers('#09090b', '#18181b', '#27272a', '#52525b')),
  builtinSurface('dark', 'dark-purple', 'Dark Purple', layers('#0f0720', '#1a103d', '#2d1b69', '#3d2785')),
  builtinSurface('dark', 'cyber-terminal', 'Cyber Terminal', layers('#0a0a0a', '#1a1a1a', '#262626', '#333333'))
]

export const BUILTIN_LIGHT_SURFACE_PRESETS = BUILTIN_THEME_COLOR_PRESETS.filter((p) => p.schema === 'light')
export const BUILTIN_DARK_SURFACE_PRESETS = BUILTIN_THEME_COLOR_PRESETS.filter((p) => p.schema === 'dark')

export function findBuiltinColorPreset(id: string): ThemeColorPreset | undefined {
  return BUILTIN_THEME_COLOR_PRESETS.find((p) => p.id === id)
}

export function isBuiltinColorPresetId(id: string): boolean {
  return id.startsWith(BUILTIN_COLOR_PRESET_PREFIX)
}
