import type { EntityRefKind } from './entity-ref'

/** Eingebaute Scan-/Suggest-Domänen. */
export type EntityLinkAiBuiltinDomainId = 'general' | 'workshop_honorar' | 'travel'

/** `general` oder Built-in oder benutzerdefinierte Profil-ID. */
export type EntityLinkAiDomainProfileId = EntityLinkAiBuiltinDomainId | string

export interface AiLinkCustomDomainProfile {
  id: string
  label: string
  /** Stichwörter für Retrieval und Prompt (kleingeschrieben). */
  keywords: string[]
}

export interface ResolvedAiLinkDomainProfile {
  id: EntityLinkAiDomainProfileId
  label: string
  subjectKeywords: string[]
  kindBoost?: EntityRefKind[]
  systemPromptAddon: string
}

export type EntityLinkQuality = 'strong' | 'moderate' | 'weak' | 'questionable'

export interface EntityLinkQualityAssessment {
  linkId: number
  peer: import('./entity-ref').ChronellEntityRef
  title: string
  quality: EntityLinkQuality
  confidence: number
  reasonText?: string
}

export interface EntityLinkEvaluateQualityInput {
  anchor: import('./entity-ref').ChronellEntityRef
  includeExcerpt?: boolean
}

export interface EntityLinkEvaluateQualityResult {
  assessments: EntityLinkQualityAssessment[]
}
