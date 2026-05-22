import type { DarkPalette, ThemeSurfaceToken } from '@/stores/theme'

/** L0–L3 pro Dunkel-Variante (deutlich unterscheidbar). */
export const DARK_PALETTE_SURFACES: Record<
  DarkPalette,
  Record<ThemeSurfaceToken, string>
> = {
  /** Fluent Graphite – leichter Violett-Stich */
  default: {
    background: '#090a0d',
    sidebar: '#14151b',
    card: '#1c1d23',
    muted: '#2a2d38'
  },
  /** Tiefes Navy – fast schwarz, kühler Blau-Verlauf */
  midnight: {
    background: '#020617',
    sidebar: '#0b1120',
    card: '#0f172a',
    muted: '#1e3a5f'
  },
  /** Polar Night – helleres Blau-Grau (klassisches Nord) */
  nord: {
    background: '#2e3440',
    sidebar: '#3b4252',
    card: '#434c5e',
    muted: '#4c566a'
  },
  /** Neutrales Warmgrau – ohne Farbstich */
  graphite: {
    background: '#121212',
    sidebar: '#1a1a1a',
    card: '#242424',
    muted: '#363636'
  }
}

/** Zusaetzliche CSS-Variablen (HSL-Tripel oder Hex) pro Variante. */
export const DARK_PALETTE_EXTRA_CSS_VARS: Record<DarkPalette, Record<string, string>> = {
  default: {
    '--popover': '230 9% 13%',
    '--secondary': '230 11% 19%',
    '--accent': '230 10% 21%',
    '--border': '230 12% 24%',
    '--input': '230 12% 28%',
    '--glass-surface': '230 9% 13% / 0.72',
    '--glass-surface-muted': '230 11% 19% / 0.58',
    '--glass-border': '0 0% 100% / 0.08',
    '--dashboard-glass-tint': '230 14% 7% / 0.42',
    '--chronell-accent-orbit': '#5a5de6'
  },
  midnight: {
    '--popover': '222 38% 11%',
    '--secondary': '217 32% 18%',
    '--accent': '215 28% 20%',
    '--border': '217 32% 30%',
    '--input': '217 35% 34%',
    '--glass-surface': '222 35% 12% / 0.78',
    '--glass-surface-muted': '217 30% 10% / 0.62',
    '--glass-border': '213 70% 88% / 0.12',
    '--dashboard-glass-tint': '222 45% 6% / 0.5',
    '--chronell-accent-orbit': '#3b82f6'
  },
  nord: {
    '--popover': '220 14% 18%',
    '--secondary': '220 12% 20%',
    '--accent': '220 11% 22%',
    '--border': '220 14% 34%',
    '--input': '220 14% 38%',
    '--glass-surface': '220 14% 18% / 0.75',
    '--glass-surface-muted': '220 16% 14% / 0.6',
    '--glass-border': '213 35% 82% / 0.14',
    '--dashboard-glass-tint': '220 16% 16% / 0.38',
    '--foreground-secondary': '213 22% 78%',
    '--muted-foreground': '220 12% 72%',
    '--chronell-accent-orbit': '#88c0d0'
  },
  graphite: {
    '--popover': '0 0% 15%',
    '--secondary': '0 0% 17%',
    '--accent': '0 0% 19%',
    '--border': '0 0% 26%',
    '--input': '0 0% 30%',
    '--glass-surface': '0 0% 16% / 0.78',
    '--glass-surface-muted': '0 0% 12% / 0.62',
    '--glass-border': '0 0% 100% / 0.1',
    '--dashboard-glass-tint': '0 0% 8% / 0.45',
    '--foreground-secondary': '0 0% 72%',
    '--muted-foreground': '0 0% 58%',
    '--chronell-accent-orbit': '#a3a3a3'
  }
}

export const DARK_PALETTE_EXTRA_VAR_NAMES = [
  ...new Set(
    Object.values(DARK_PALETTE_EXTRA_CSS_VARS).flatMap((row) => Object.keys(row))
  )
]
