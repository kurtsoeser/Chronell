import type { EntityLinkQuality } from '@shared/entity-links'

/** Stroke-Farbe für KI-Qualitätsanzeige am Graph (CSS-Farbe). */
export function graphEdgeQualityStroke(quality: EntityLinkQuality | undefined): string | null {
  switch (quality) {
    case 'strong':
      return '#10b981'
    case 'moderate':
      return null
    case 'weak':
      return '#f59e0b'
    case 'questionable':
      return '#ef4444'
    default:
      return null
  }
}
