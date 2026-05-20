import { normalizeEntityIconColor } from '@shared/entity-icon-color'
import { accountColorToRgba } from '@/lib/avatar-color'
import { ENTITY_ICON_COLOR_PRESETS } from '@shared/entity-icon-color'

export interface ClusterIslandStyle {
  color: string
  /** Füll-Deckkraft (0.02–0.4). */
  opacity: number
}

export const DEFAULT_ISLAND_FILL_OPACITY = 0.1
export const DEFAULT_ISLAND_STROKE_OPACITY = 0.34

export function normalizeClusterIslandStyle(
  value: unknown
): ClusterIslandStyle | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ClusterIslandStyle>
  const color = normalizeEntityIconColor(
    typeof v.color === 'string' ? v.color : null
  )
  if (!color) return null
  const opacity =
    typeof v.opacity === 'number' && Number.isFinite(v.opacity)
      ? Math.min(0.4, Math.max(0.02, v.opacity))
      : DEFAULT_ISLAND_FILL_OPACITY
  return { color, opacity }
}

export function parseClusterIslandStyles(
  value: unknown
): Record<string, ClusterIslandStyle> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, ClusterIslandStyle> = {}
  for (const [key, raw] of Object.entries(value)) {
    const style = normalizeClusterIslandStyle(raw)
    if (style) out[key] = style
  }
  return out
}

export function islandStyleToFillRgba(style: ClusterIslandStyle): string {
  return (
    accountColorToRgba(style.color, style.opacity) ??
    `rgba(148, 163, 184, ${style.opacity})`
  )
}

export function islandStyleToStrokeRgba(style: ClusterIslandStyle): string {
  const strokeAlpha = Math.min(0.65, style.opacity * 3.2)
  return (
    accountColorToRgba(style.color, strokeAlpha) ??
    `rgba(148, 163, 184, ${strokeAlpha})`
  )
}

export { ENTITY_ICON_COLOR_PRESETS }
