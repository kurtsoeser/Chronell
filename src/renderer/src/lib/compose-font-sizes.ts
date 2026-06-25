/** Schriftgrößen im Compose-Editor (pt, für TipTap FontSize). */
export const COMPOSE_FONT_SIZES_PT: readonly number[] = Array.from(
  { length: 36 - 8 + 1 },
  (_, i) => 8 + i
)

export function composeFontSizePtOptionValue(pt: number): string {
  return `${pt}pt`
}

export function normalizeComposeFontSizePt(raw: unknown, fallback = 11): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  const min = COMPOSE_FONT_SIZES_PT[0]!
  const max = COMPOSE_FONT_SIZES_PT[COMPOSE_FONT_SIZES_PT.length - 1]!
  return Math.min(max, Math.max(min, Math.round(n)))
}
