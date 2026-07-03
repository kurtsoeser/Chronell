export const NOTE_INK_BUILTIN_PEN_COLORS = [
  '#111827',
  '#4b5563',
  '#2563eb',
  '#1d4ed8',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#7c3aed',
  '#db2777',
  '#92400e'
] as const

export const NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS = [
  '#facc15',
  '#fde047',
  '#4ade80',
  '#86efac',
  '#f472b6',
  '#fda4af',
  '#38bdf8',
  '#c084fc',
  '#fb923c',
  '#f87171'
] as const

/** @deprecated Alias — bitte NOTE_INK_BUILTIN_PEN_COLORS verwenden. */
export const NOTE_INK_DEFAULT_COLORS = NOTE_INK_BUILTIN_PEN_COLORS

/** @deprecated Alias — bitte NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS verwenden. */
export const NOTE_INK_HIGHLIGHTER_COLORS = NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS

export function normalizeInkHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/)
  if (!short) return null
  const [r, g, b] = short[1]!
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
}

export function mergeInkColorPalette(
  builtin: readonly string[],
  custom: readonly string[],
  activeColor?: string | null
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string): void => {
    const color = normalizeInkHexColor(raw)
    if (!color || seen.has(color)) return
    seen.add(color)
    out.push(color)
  }
  for (const color of builtin) push(color)
  for (const color of custom) push(color)
  if (activeColor) push(activeColor)
  return out
}
