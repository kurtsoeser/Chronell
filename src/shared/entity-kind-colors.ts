import type { EntityRefKind } from './entity-ref'

/** Standard-Farben für Entity-Knoten im Verbindungs-Graph. */
export const ENTITY_KIND_DOT_COLORS: Record<EntityRefKind, string> = {
  mail: '#0ea5e9',
  mail_todo: '#f59e0b',
  cloud_task: '#10b981',
  calendar_event: '#8b5cf6',
  note: '#ca8a04',
  people_contact: '#f43f5e'
}
