export type BuiltinNotePageTemplateId = 'blank' | 'meeting' | 'project' | 'weekly' | 'checklist'

/** Eingebaute oder benutzerdefinierte Vorlagen-ID (`custom-…`). */
export type NotePageTemplateId = BuiltinNotePageTemplateId | string

export interface BuiltinNotePageTemplate {
  id: BuiltinNotePageTemplateId
  titleKey: string
  descriptionKey: string
  bodyHtml: string
}

export interface ResolvedNotePageTemplate {
  id: string
  title: string
  description: string
  bodyHtml: string
  builtin: boolean
}

const TASK_ITEM = (label: string, checked = false): string =>
  `<li data-checked="${checked ? 'true' : 'false'}" data-type="taskItem"><p>${label}</p></li>`

const TASK_LIST = (...items: string[]): string =>
  `<ul data-type="taskList">${items.join('')}</ul>`

export const NOTE_PAGE_TEMPLATES: BuiltinNotePageTemplate[] = [
  {
    id: 'blank',
    titleKey: 'notes.templates.blank.title',
    descriptionKey: 'notes.templates.blank.description',
    bodyHtml: ''
  },
  {
    id: 'meeting',
    titleKey: 'notes.templates.meeting.title',
    descriptionKey: 'notes.templates.meeting.description',
    bodyHtml: [
      '<h2>Meeting</h2>',
      '<p><strong>Datum:</strong> </p>',
      '<p><strong>Teilnehmer:</strong> </p>',
      '<h3>Agenda</h3>',
      '<ul><li></li></ul>',
      '<h3>Notizen</h3>',
      '<p></p>',
      '<h3>Nächste Schritte</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'project',
    titleKey: 'notes.templates.project.title',
    descriptionKey: 'notes.templates.project.description',
    bodyHtml: [
      '<h2>Projekt</h2>',
      '<p><strong>Ziel:</strong> </p>',
      '<p><strong>Status:</strong> </p>',
      '<h3>Meilensteine</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Offene Punkte</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'weekly',
    titleKey: 'notes.templates.weekly.title',
    descriptionKey: 'notes.templates.weekly.description',
    bodyHtml: [
      '<h2>Wochenplan</h2>',
      '<p><strong>KW / Zeitraum:</strong> </p>',
      '<h3>Prioritäten</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Notizen</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'checklist',
    titleKey: 'notes.templates.checklist.title',
    descriptionKey: 'notes.templates.checklist.description',
    bodyHtml: TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''))
  }
]

export function isBuiltinNotePageTemplateId(value: string): value is BuiltinNotePageTemplateId {
  return NOTE_PAGE_TEMPLATES.some((t) => t.id === value)
}

/** @deprecated Verwende {@link resolveNotePageTemplate}. */
export function notePageTemplateById(id: BuiltinNotePageTemplateId): BuiltinNotePageTemplate {
  return NOTE_PAGE_TEMPLATES.find((t) => t.id === id) ?? NOTE_PAGE_TEMPLATES[0]
}

export function isNotePageTemplateId(value: string): value is BuiltinNotePageTemplateId {
  return isBuiltinNotePageTemplateId(value)
}

export function resolveNotePageTemplate(
  id: string,
  customTemplates: readonly { id: string; name: string; description: string; bodyHtml: string }[],
  translate: (key: string) => string
): ResolvedNotePageTemplate {
  const builtin = NOTE_PAGE_TEMPLATES.find((t) => t.id === id)
  if (builtin) {
    return {
      id: builtin.id,
      title: translate(builtin.titleKey),
      description: translate(builtin.descriptionKey),
      bodyHtml: builtin.bodyHtml,
      builtin: true
    }
  }
  const custom = customTemplates.find((t) => t.id === id)
  if (custom) {
    return {
      id: custom.id,
      title: custom.name,
      description: custom.description,
      bodyHtml: custom.bodyHtml,
      builtin: false
    }
  }
  const fallback = NOTE_PAGE_TEMPLATES[0]
  return {
    id: fallback.id,
    title: translate(fallback.titleKey),
    description: translate(fallback.descriptionKey),
    bodyHtml: fallback.bodyHtml,
    builtin: true
  }
}

export function listAllNotePageTemplates(
  customTemplates: readonly { id: string; name: string; description: string; bodyHtml: string }[],
  translate: (key: string) => string
): ResolvedNotePageTemplate[] {
  const builtins = NOTE_PAGE_TEMPLATES.map((t) => resolveNotePageTemplate(t.id, customTemplates, translate))
  const customs = customTemplates.map((t) => resolveNotePageTemplate(t.id, customTemplates, translate))
  return [...builtins, ...customs]
}
