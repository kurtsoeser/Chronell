import type { ChronellEntityRef, EntityRefKind } from './entity-ref'

export interface EntityLinkedItem {
  linkId: number
  peer: ChronellEntityRef
  title: string
  subtitle: string | null
  createdAt: string
  linkKind: string | null
}

export interface EntityLinksListResult {
  anchor: ChronellEntityRef
  links: EntityLinkedItem[]
}

export interface EntityLinkTargetCandidate {
  target: ChronellEntityRef
  title: string
  subtitle: string | null
}

export type EntityLinkSuggestionReason = 'sender_email' | 'subject_calendar' | 'ai_semantic'

export interface EntityLinkSuggestion extends EntityLinkTargetCandidate {
  reason: EntityLinkSuggestionReason
  /** Nur bei KI-Vorschlägen (0–1). */
  confidence?: number
  /** Freitext-Begründung von der KI (Anzeige neben Badge). */
  reasonText?: string
  /** Beide Provider stimmen überein (Vergleichsmodus). */
  providerConsensus?: boolean
}

export interface EntityLinkChainStep {
  ref: ChronellEntityRef
  title: string
}

/** Kette von 2–4 Objekten (z. B. Kontakt → Mail → Termin). */
export interface EntityLinkSuggestionChain {
  steps: EntityLinkChainStep[]
  confidence: number
  reasonText?: string
  providerConsensus?: boolean
}

export interface EntityLinkAiSuggestResult {
  suggestions: EntityLinkSuggestion[]
  chains: EntityLinkSuggestionChain[]
}

export interface EntityLinkAiSuggestInput {
  anchor: ChronellEntityRef
  maxCandidates?: number
}

export type EntityLinkAiScanProfile = 'sparse_mails' | 'recent_30' | 'contacts_calendar'

export interface EntityLinkGraphDensityStats {
  lookbackDays: number
  mailInRange: number
  mailUnlinked: number
  mailUnlinkedPercent: number
}

export interface EntityLinkAiScanCostEstimate {
  anchorCount: number
  apiCalls: number
  tokensEstimate: number
  compareProviders: boolean
}

export interface EntityLinkAiScanAnchor {
  ref: ChronellEntityRef
  title: string
}

export interface EntityLinkAiScanInput {
  maxAnchors?: number
  lookbackDays?: number
  /** Scan-Profil (ohne explizite anchors). */
  scanProfile?: EntityLinkAiScanProfile
  /** Nur diese Anker scannen (z. B. Canvas-Auswahl / Insel); max. 50. */
  anchors?: EntityLinkAiScanAnchor[]
}

export interface EntityLinkAiScanProgress {
  done: number
  total: number
  suggestionsFound: number
  cancelled?: boolean
}

/** Ein Vorschlag aus dem Graph-Scan (Anker + Ziel). */
export interface EntityLinkAiScanItem {
  id: string
  anchor: ChronellEntityRef
  anchorTitle: string
  suggestion: EntityLinkSuggestion
  /** Optionale Kette, zu der dieser Einzelvorschlag gehört. */
  chain?: EntityLinkSuggestionChain
}

export interface EntityLinkAiScanStatus {
  running: boolean
  progress: EntityLinkAiScanProgress
  items: EntityLinkAiScanItem[]
  error: string | null
}

export interface EntityLinkAiDismissInput {
  anchor: ChronellEntityRef
  peer: ChronellEntityRef
}

export interface EntityPaletteListInput {
  /** Einzelne Art (Legacy); ignoriert wenn `kinds` gesetzt. */
  kind?: EntityRefKind
  /** Eine oder mehrere Objektarten (Palette-Filter). */
  kinds?: EntityRefKind[]
  query?: string
  limit?: number
}

export interface EntityNeighborhoodInput {
  anchor: ChronellEntityRef
  /** Standard: 1 (direkte Nachbarn). */
  depth?: number
}

export interface EntityLinkPathInput {
  from: ChronellEntityRef
  to: ChronellEntityRef
  maxHops?: number
}

export interface EntityLinkPathResult {
  nodes: EntityGraphNode[]
  edges: EntityGraphEdge[]
}

export interface EntityLinkAddInput {
  a: ChronellEntityRef
  b: ChronellEntityRef
  linkKind?: string | null
}

export interface EntityLinkRemoveInput {
  linkId: number
  /** Optional: nur loeschen wenn der Anker an dieser Verknuepfung beteiligt ist. */
  anchor?: ChronellEntityRef
}

export interface EntityLinkSearchTargetsInput {
  anchor: ChronellEntityRef
  query?: string
  kinds?: EntityRefKind[]
  limit?: number
}

/** Knoten im Verbindungs-Graphen (Modul „Verbindungen“). */
export interface EntityGraphNode {
  key: string
  ref: ChronellEntityRef
  kind: EntityRefKind
  title: string
  subtitle: string | null
  /** Gruppierung (z. B. account:…, scope:notes, kind:mail). */
  clusterKey: string
  layoutScope?: string
  layoutTimeMonth?: string | null
  layoutTimeWeek?: string | null
  layoutTimeYear?: string | null
  layoutDomain?: string | null
  layoutCompany?: string | null
  layoutCalendarList?: string | null
  layoutCalendarListLabel?: string | null
  layoutTaskList?: string | null
  layoutTaskListLabel?: string | null
  layoutFolderId?: number | null
}

export type EntityGraphClusterMode =
  | 'account'
  | 'kind'
  | 'scope'
  | 'none'
  | 'component'
  | 'time_month'
  | 'time_week'
  | 'time_year'
  | 'domain'
  | 'company'
  | 'calendar_list'
  | 'task_list'

export interface EntityGraphEdge {
  linkId: number
  aKey: string
  bKey: string
  linkKind: string | null
}

export interface EntityGraphSnapshot {
  nodes: EntityGraphNode[]
  edges: EntityGraphEdge[]
}
