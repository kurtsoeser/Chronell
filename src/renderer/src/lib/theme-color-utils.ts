/** Normalisiert Hex-Farben (#RGB oder #RRGGBB). */
export function normalizeHex(hex: string): string | null {
  const v = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase()
  }
  return null
}

/** Wandelt Hex in ein HSL-Tripel fuer CSS-Variablen um (z. B. "220 6% 8%"). */
export function hexToHslTriplet(hex: string): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return '0 0% 50%'

  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Entspricht `.chronell-surface-flat`: `color-mix(in srgb, card 96%, transparent)`
 * ueber `background` (L0).
 */
export function mixFlatSurfaceHex(
  cardHex: string,
  backgroundHex: string,
  cardWeight = 0.96
): string {
  const card = parseHexRgb(cardHex)
  const bg = parseHexRgb(backgroundHex)
  if (!card || !bg) return normalizeHex(cardHex) ?? cardHex
  const w = cardWeight
  return rgbToHex(
    card.r * w + bg.r * (1 - w),
    card.g * w + bg.g * (1 - w),
    card.b * w + bg.b * (1 - w)
  )
}

/** Komplement zu einer Flaechenfarbe fuer Mail-Dunkelvorschau (invert + hue-rotate). */
export function invertComplementHex(hex: string): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return '#e3e2dc'

  const r = 255 - parseInt(normalized.slice(1, 3), 16)
  const g = 255 - parseInt(normalized.slice(3, 5), 16)
  const b = 255 - parseInt(normalized.slice(5, 7), 16)
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
