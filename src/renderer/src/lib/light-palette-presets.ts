import type { ThemeSurfaceToken } from '@/stores/theme'

export type LightPalette = 'default' | 'midnight' | 'nord' | 'graphite'

/** L0–L3 pro Hell-Variante (Analog zu den Dunkel-Varianten). */
export const LIGHT_PALETTE_SURFACES: Record<
  LightPalette,
  Record<ThemeSurfaceToken, string>
> = {
  /** Fluent – leichter Violett-Stich (App-Standard Hell) */
  default: {
    background: '#f6f7fa',
    sidebar: '#e9ecf2',
    card: '#ffffff',
    muted: '#e5e9f1'
  },
  /** Kühles Hellblau (Gegenstück zu Midnight) */
  midnight: {
    background: '#f0f4ff',
    sidebar: '#e2e8f7',
    card: '#ffffff',
    muted: '#c7d2e8'
  },
  /** Nord Snow – helles Polar-Blau-Grau */
  nord: {
    background: '#eceff4',
    sidebar: '#e5e9f0',
    card: '#f8fafc',
    muted: '#d8dee9'
  },
  /** Warm Paper – neutrales Warmweiß (Gegenstück zu Graphite) */
  graphite: {
    background: '#f7f4ef',
    sidebar: '#ebe6dc',
    card: '#fffdf9',
    muted: '#e3ddd2'
  }
}

export const DEFAULT_LIGHT_PALETTE: LightPalette = 'default'
