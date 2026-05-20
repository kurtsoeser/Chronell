import { DARK_PALETTE_SURFACES } from '@/lib/dark-palette-presets'
import {
  DEFAULT_LIGHT_PALETTE,
  LIGHT_PALETTE_SURFACES
} from '@/lib/light-palette-presets'

export type ThemeSurfaceToken = 'background' | 'sidebar' | 'card' | 'muted'
export type EffectiveTheme = 'light' | 'dark'

/** Standard-Hexwerte fuer die UI (entsprechen globals.css / App-Standard). */
export const DEFAULT_SURFACE_HEX: Record<EffectiveTheme, Record<ThemeSurfaceToken, string>> = {
  light: {
    ...LIGHT_PALETTE_SURFACES[DEFAULT_LIGHT_PALETTE]
  },
  dark: {
    ...DARK_PALETTE_SURFACES.graphite
  }
}
