/** Polymorphe Objekt-Referenz im Chronell-Verknüpfungsnetz (ungerichtet). */
export const ENTITY_REF_KINDS = [
  'note',
  'mail',
  'mail_todo',
  'calendar_event',
  'cloud_task',
  'people_contact'
] as const

export type EntityRefKind = (typeof ENTITY_REF_KINDS)[number]

export type ChronellEntityRef =
  | { kind: 'note'; noteId: number }
  | { kind: 'mail'; messageId: number }
  | { kind: 'mail_todo'; todoId: number }
  | { kind: 'calendar_event'; accountId: string; graphEventId: string }
  | { kind: 'cloud_task'; accountId: string; listId: string; taskId: string }
  | { kind: 'people_contact'; contactId: number }

export function isEntityRefKind(value: string): value is EntityRefKind {
  return (ENTITY_REF_KINDS as readonly string[]).includes(value)
}

export function entityRefKey(ref: ChronellEntityRef): string {
  switch (ref.kind) {
    case 'note':
      return `note:${ref.noteId}`
    case 'mail':
      return `mail:${ref.messageId}`
    case 'mail_todo':
      return `mail-todo:${ref.todoId}`
    case 'calendar_event':
      return `calendar:${ref.accountId}:${ref.graphEventId}`
    case 'cloud_task':
      return `task:${ref.accountId}:${ref.listId}:${ref.taskId}`
    case 'people_contact':
      return `contact:${ref.contactId}`
    default:
      return 'unknown'
  }
}

export function entityRefsEqual(a: ChronellEntityRef, b: ChronellEntityRef): boolean {
  return entityRefKey(a) === entityRefKey(b)
}

/** Sortiert zwei Referenzen für kanonische Speicherung (ref_a ≤ ref_b). */
export function canonicalEntityRefPair(
  a: ChronellEntityRef,
  b: ChronellEntityRef
): [ChronellEntityRef, ChronellEntityRef] {
  const ka = entityRefKey(a)
  const kb = entityRefKey(b)
  if (ka <= kb) return [a, b]
  return [b, a]
}

export function isSelfEntityLink(a: ChronellEntityRef, b: ChronellEntityRef): boolean {
  return entityRefsEqual(a, b)
}

/** Parst `entityRefKey`-Format zurück in eine Referenz (für Embedding-Index). */
export function parseEntityRefKey(key: string): ChronellEntityRef | null {
  const mail = /^mail:(\d+)$/.exec(key)
  if (mail) return { kind: 'mail', messageId: Number(mail[1]) }
  const todo = /^mail-todo:(\d+)$/.exec(key)
  if (todo) return { kind: 'mail_todo', todoId: Number(todo[1]) }
  const note = /^note:(\d+)$/.exec(key)
  if (note) return { kind: 'note', noteId: Number(note[1]) }
  const contact = /^contact:(\d+)$/.exec(key)
  if (contact) return { kind: 'people_contact', contactId: Number(contact[1]) }
  const cal = /^calendar:([^:]+):(.+)$/.exec(key)
  if (cal) return { kind: 'calendar_event', accountId: cal[1]!, graphEventId: cal[2]! }
  const task = /^task:([^:]+):([^:]+):(.+)$/.exec(key)
  if (task) {
    return {
      kind: 'cloud_task',
      accountId: task[1]!,
      listId: task[2]!,
      taskId: task[3]!
    }
  }
  return null
}
