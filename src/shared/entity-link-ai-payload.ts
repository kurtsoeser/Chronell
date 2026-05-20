import type { EntityRefKind } from './entity-ref'

export type EntityLinkAiExcerptSource = 'none' | 'mail_preview' | 'mail_body' | 'note' | 'event'

export interface EntityLinkAiPayloadField {
  key: string
  label: string
  value: string
}

/** Vorschau dessen, was an die Cloud-KI gesendet würde (ohne tatsächlichen API-Aufruf). */
export interface EntityLinkAiPayloadPreview {
  anchorTitle: string
  kind: EntityRefKind
  metadataFields: EntityLinkAiPayloadField[]
  excerpt: string | null
  excerptSource: EntityLinkAiExcerptSource
  excerptCharCount: number
  metadataCharEstimate: number
  totalCharEstimate: number
  includeExcerpt: boolean
}

export interface EntityLinkAiPayloadPreviewInput {
  anchor: import('./entity-ref').ChronellEntityRef
  /** Simuliert „Auszug mitsenden“ für die Vorschau. */
  includeExcerpt?: boolean
}

export type EntityLinkSuggestionCountSource = 'heuristic' | 'ai_scan' | 'ai_panel'

export interface EntityLinkSuggestionCountEntry {
  anchorKey: string
  count: number
  source: EntityLinkSuggestionCountSource
}
