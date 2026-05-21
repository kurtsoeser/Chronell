/** Schriftgrößen im Compose-Editor (pt, für TipTap FontSize). */
export const COMPOSE_FONT_SIZES_PT: readonly number[] = Array.from(
  { length: 36 - 8 + 1 },
  (_, i) => 8 + i
)

export function composeFontSizePtOptionValue(pt: number): string {
  return `${pt}pt`
}
