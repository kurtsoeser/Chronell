/**
 * Baked-in Webinar-Layout-Themes: 6 Akzentfarben × hell/dunkel.
 * Alle Varianten werden aus dem dunklen Gold-Standard per Hex-Tausch erzeugt.
 */

export const WEBINAR_LAYOUT_COLOR_IDS = [
  'gold',
  'blue',
  'green',
  'purple',
  'red',
  'gray'
] as const
export const WEBINAR_LAYOUT_MODE_IDS = ['dark', 'light'] as const

export type WebinarLayoutColorId = (typeof WEBINAR_LAYOUT_COLOR_IDS)[number]
export type WebinarLayoutModeId = (typeof WEBINAR_LAYOUT_MODE_IDS)[number]

/** Farb-ID = dunkel; `*-light` = hell. */
export type WebinarLayoutThemeId =
  | WebinarLayoutColorId
  | `${WebinarLayoutColorId}-light`

export const WEBINAR_LAYOUT_THEME_IDS: readonly WebinarLayoutThemeId[] =
  WEBINAR_LAYOUT_COLOR_IDS.flatMap((color) => [color, `${color}-light` as const])

export type WebinarLayoutThemeAccents = {
  accent: string
  accentDark: string
  accentGlow: string
  link: string
}

/** Akzente (Dunkelmodus-Defaults). */
export const WEBINAR_LAYOUT_THEME_ACCENTS: Record<
  WebinarLayoutColorId,
  WebinarLayoutThemeAccents
> = {
  gold: {
    accent: '#c9a962',
    accentDark: '#8a7340',
    accentGlow: '#3d3420',
    link: '#e8d5a3'
  },
  blue: {
    accent: '#5b9bd5',
    accentDark: '#3d7ab0',
    accentGlow: '#1e3348',
    link: '#a8cce8'
  },
  green: {
    accent: '#6bbf8a',
    accentDark: '#3d8f5c',
    accentGlow: '#1e3a2a',
    link: '#b5e0c4'
  },
  purple: {
    accent: '#9b7ec8',
    accentDark: '#6b4f8f',
    accentGlow: '#2e2438',
    link: '#d4c4e8'
  },
  red: {
    accent: '#d07070',
    accentDark: '#a04545',
    accentGlow: '#3a2020',
    link: '#e8b8b8'
  },
  gray: {
    accent: '#9a958c',
    accentDark: '#6b6660',
    accentGlow: '#2a2826',
    link: '#d0ccc4'
  }
}

/** Hellmodus: gleiche Akzentfarbe, helleres Glow, dunklerer Link fuer Kontrast. */
const LIGHT_ACCENT_TWEAKS: Record<
  WebinarLayoutColorId,
  Pick<WebinarLayoutThemeAccents, 'accentGlow' | 'link'>
> = {
  gold: { accentGlow: '#f3ecd4', link: '#7a6530' },
  blue: { accentGlow: '#dceaf6', link: '#2a6a9e' },
  green: { accentGlow: '#dcefe4', link: '#2d7a4c' },
  purple: { accentGlow: '#ece4f4', link: '#5c3d7a' },
  red: { accentGlow: '#f5e0e0', link: '#9a3535' },
  gray: { accentGlow: '#ebe8e3', link: '#4a4742' }
}

/** Dunkle Flaechen — Basis des Generators. */
export const WEBINAR_LAYOUT_DARK_SURFACES = {
  outer: '#0f0f0f',
  inner: '#141414',
  card: '#181818',
  panel: '#1f1f1f',
  border: '#2e2e2e',
  borderSoft: '#3a3a3a',
  text: '#f4f1ea',
  muted: '#b8b2a6',
  teamsPanel: '#151b28',
  teamsBorder: '#2a3348',
  webBtn: '#242424'
} as const

/** Helle Flaechen — gleiche Struktur, heller Hintergrund. */
export const WEBINAR_LAYOUT_LIGHT_SURFACES = {
  outer: '#f5f2eb',
  inner: '#ffffff',
  card: '#ffffff',
  panel: '#f0ebe3',
  border: '#ddd6c8',
  borderSoft: '#cfc7b8',
  text: '#1c1a16',
  muted: '#5e574c',
  teamsPanel: '#e8eef8',
  teamsBorder: '#c5d0e8',
  webBtn: '#ece8e0'
} as const

export function isWebinarLayoutColorId(value: unknown): value is WebinarLayoutColorId {
  return (
    typeof value === 'string' &&
    (WEBINAR_LAYOUT_COLOR_IDS as readonly string[]).includes(value)
  )
}

export function isWebinarLayoutModeId(value: unknown): value is WebinarLayoutModeId {
  return value === 'dark' || value === 'light'
}

export function isWebinarLayoutThemeId(value: unknown): value is WebinarLayoutThemeId {
  return (
    typeof value === 'string' &&
    (WEBINAR_LAYOUT_THEME_IDS as readonly string[]).includes(value)
  )
}

export function webinarLayoutThemeParts(theme: WebinarLayoutThemeId): {
  color: WebinarLayoutColorId
  mode: WebinarLayoutModeId
} {
  if (theme.endsWith('-light')) {
    const color = theme.slice(0, -'-light'.length)
    if (isWebinarLayoutColorId(color)) return { color, mode: 'light' }
  }
  if (isWebinarLayoutColorId(theme)) return { color: theme, mode: 'dark' }
  return { color: 'gold', mode: 'dark' }
}

export function makeWebinarLayoutThemeId(
  color: WebinarLayoutColorId,
  mode: WebinarLayoutModeId
): WebinarLayoutThemeId {
  return mode === 'light' ? `${color}-light` : color
}

export function webinarLayoutThemeAccents(
  color: WebinarLayoutColorId,
  mode: WebinarLayoutModeId = 'dark'
): WebinarLayoutThemeAccents {
  const base = WEBINAR_LAYOUT_THEME_ACCENTS[color]
  if (mode === 'dark') return base
  return { ...base, ...LIGHT_ACCENT_TWEAKS[color] }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceHexAll(html: string, from: string, to: string): string {
  if (from.toLowerCase() === to.toLowerCase()) return html
  return html.replace(new RegExp(escapeRegExp(from), 'gi'), to)
}

/**
 * Wandelt dunkles Gold-HTML in die Ziel-Vorlage um (Flaechen + Akzente).
 */
export function applyWebinarLayoutThemeColors(
  html: string,
  theme: WebinarLayoutThemeId
): string {
  if (!html) return html
  const { color, mode } = webinarLayoutThemeParts(theme)
  let out = html

  if (mode === 'light') {
    const d = WEBINAR_LAYOUT_DARK_SURFACES
    const l = WEBINAR_LAYOUT_LIGHT_SURFACES
    // Spezifischere / laengere Werte zuerst
    const surfacePairs: Array<[string, string]> = [
      [d.teamsPanel, l.teamsPanel],
      [d.teamsBorder, l.teamsBorder],
      [d.borderSoft, l.borderSoft],
      [d.webBtn, l.webBtn],
      [d.outer, l.outer],
      [d.inner, l.inner],
      [d.card, l.card],
      [d.panel, l.panel],
      [d.border, l.border],
      [d.text, l.text],
      [d.muted, l.muted]
    ]
    for (const [from, to] of surfacePairs) {
      out = replaceHexAll(out, from, to)
    }
  }

  const fromAccents = WEBINAR_LAYOUT_THEME_ACCENTS.gold
  const toAccents = webinarLayoutThemeAccents(color, mode)
  const accentPairs: Array<[string, string]> = [
    [fromAccents.accentGlow, toAccents.accentGlow],
    [fromAccents.accentDark, toAccents.accentDark],
    [fromAccents.link, toAccents.link],
    [fromAccents.accent, toAccents.accent]
  ]
  // Bei light-gold: Glow/Link trotzdem tauschen (Basis-HTML hat dunkles goldGlow/link)
  for (const [from, to] of accentPairs) {
    out = replaceHexAll(out, from, to)
  }

  return out
}

/** @deprecated Alias — gleiche API wie {@link applyWebinarLayoutThemeColors}. */
export const applyWebinarLayoutTheme = applyWebinarLayoutThemeColors
