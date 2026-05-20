import {
  ENTITY_REF_KINDS,
  type ChronellEntityRef,
  type EntityRefKind,
  entityRefKey,
  entityRefsEqual,
  isEntityRefKind
} from './entity-ref'

/** @deprecated Alias – gleiche Typen wie {@link ChronellEntityRef}. */
export const NOTE_ENTITY_LINK_TARGET_KINDS = ENTITY_REF_KINDS

export type NoteEntityLinkTargetKind = EntityRefKind

export type NoteEntityLinkTarget = ChronellEntityRef

export interface NoteEntityLinkedItem {
  linkId: number
  target: NoteEntityLinkTarget
  title: string
  subtitle: string | null
  createdAt: string
}

export interface NoteLinksBundle {
  outgoing: NoteEntityLinkedItem[]
  incoming: NoteEntityLinkedItem[]
}

export interface NoteLinkTargetCandidate {
  target: NoteEntityLinkTarget
  title: string
  subtitle: string | null
}

export function isNoteEntityLinkTargetKind(value: string): value is NoteEntityLinkTargetKind {
  return isEntityRefKind(value)
}

export const noteEntityLinkTargetKey = entityRefKey

export const noteEntityLinkTargetsEqual = entityRefsEqual
