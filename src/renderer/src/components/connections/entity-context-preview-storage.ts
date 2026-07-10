export const ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_KEY =
  'mailclient.entityContext.noteSectionHeight'
export const ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_KEY =
  'mailclient.entityContext.graphSectionHeight'

/** Standardhöhe Notiz-Bereich im Kontext-Panel (px). */
export const ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_DEFAULT = 160
export const ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_MIN = 72
export const ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_MAX = 520

/** Standardhöhe Mini-Graph im Kontext-Bereich (px). */
export const ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_DEFAULT = 220
export const ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_MIN = 100
export const ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_MAX = 560

function sectionHeightMax(fallbackMax: number, min: number): number {
  if (typeof window === 'undefined') return fallbackMax
  return Math.max(
    min + 40,
    Math.min(fallbackMax, Math.round(window.innerHeight * 0.55))
  )
}

export function entityContextNoteSectionHeightMax(): number {
  return sectionHeightMax(
    ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_MAX,
    ENTITY_CONTEXT_NOTE_SECTION_HEIGHT_MIN
  )
}

export function entityContextGraphSectionHeightMax(): number {
  return sectionHeightMax(
    ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_MAX,
    ENTITY_CONTEXT_GRAPH_SECTION_HEIGHT_MIN
  )
}
