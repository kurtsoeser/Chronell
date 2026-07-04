import { buildNoteDateFieldHtml } from '@shared/note-form-field'

export type BuiltinNotePageTemplateGroupKey =
  | 'general'
  | 'meetings'
  | 'projects'
  | 'productivity'
  | 'lists'
  | 'events'
  | 'people'
  | 'tech'

export type BuiltinNotePageTemplateId =
  | 'blank'
  | 'meeting'
  | 'oneOnOne'
  | 'standup'
  | 'workshop'
  | 'project'
  | 'sprintRetro'
  | 'decisionLog'
  | 'riskRegister'
  | 'weekly'
  | 'weeklyOverview'
  | 'monthlyOverview'
  | 'monthlyFitnessTracker'
  | 'weeklyTimetable'
  | 'studentAttendanceList'
  | 'dailyPlanner'
  | 'dailyReview'
  | 'okr'
  | 'habitTracker'
  | 'checklist'
  | 'packingList'
  | 'readingNotes'
  | 'recipe'
  | 'tripPlan'
  | 'eventPlan'
  | 'contactProfile'
  | 'interviewNotes'
  | 'feedback360'
  | 'bugReport'
  | 'apiDesign'
  | 'incidentReport'

/** Parametrische Planer-Vorlagen (Woche/Monat/Tag per Dialog). */
export type NotePlannerTemplateKind =
  | 'weeklyOverview'
  | 'monthlyOverview'
  | 'monthlyFitnessTracker'
  | 'dailyPlanner'

/** Eingebaute oder benutzerdefinierte Vorlagen-ID (`custom-…`). */
export type NotePageTemplateId = BuiltinNotePageTemplateId | string

export interface BuiltinNotePageTemplate {
  id: BuiltinNotePageTemplateId
  groupKey: BuiltinNotePageTemplateGroupKey
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
  groupKey?: BuiltinNotePageTemplateGroupKey
}

export interface NotePageTemplateGroup {
  key: BuiltinNotePageTemplateGroupKey
  label: string
  templates: ResolvedNotePageTemplate[]
}

export const NOTE_PAGE_TEMPLATE_GROUP_ORDER: readonly BuiltinNotePageTemplateGroupKey[] = [
  'general',
  'meetings',
  'projects',
  'productivity',
  'lists',
  'events',
  'people',
  'tech'
]

const TASK_ITEM = (label: string, checked = false): string =>
  `<li data-checked="${checked ? 'true' : 'false'}" data-type="taskItem"><p>${label}</p></li>`

const TASK_LIST = (...items: string[]): string =>
  `<ul data-type="taskList">${items.join('')}</ul>`

const BULLET_LIST = (...items: string[]): string =>
  `<ul>${items.map((item) => `<li><p>${item}</p></li>`).join('')}</ul>`

export const NOTE_PAGE_TEMPLATES: BuiltinNotePageTemplate[] = [
  {
    id: 'blank',
    groupKey: 'general',
    titleKey: 'notes.templates.blank.title',
    descriptionKey: 'notes.templates.blank.description',
    bodyHtml: ''
  },
  {
    id: 'meeting',
    groupKey: 'meetings',
    titleKey: 'notes.templates.meeting.title',
    descriptionKey: 'notes.templates.meeting.description',
    bodyHtml: [
      '<h2>Meeting</h2>',
      `<p><strong>Datum:</strong> ${buildNoteDateFieldHtml()}</p>`,
      '<p><strong>Teilnehmer:</strong> </p>',
      '<h3>Agenda</h3>',
      BULLET_LIST('', ''),
      '<h3>Notizen</h3>',
      '<p></p>',
      '<h3>Nächste Schritte</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'oneOnOne',
    groupKey: 'meetings',
    titleKey: 'notes.templates.oneOnOne.title',
    descriptionKey: 'notes.templates.oneOnOne.description',
    bodyHtml: [
      '<h2>1:1-Gespräch</h2>',
      '<p><strong>Mit:</strong> </p>',
      '<p><strong>Datum / Rhythmus:</strong> </p>',
      '<h3>Meine Themen</h3>',
      BULLET_LIST('', ''),
      '<h3>Themen der anderen Person</h3>',
      BULLET_LIST('', ''),
      '<h3>Erkenntnisse &amp; Vereinbarungen</h3>',
      '<p></p>',
      '<h3>Nächstes Mal</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'standup',
    groupKey: 'meetings',
    titleKey: 'notes.templates.standup.title',
    descriptionKey: 'notes.templates.standup.description',
    bodyHtml: [
      '<h2>Daily Standup</h2>',
      `<p><strong>Datum:</strong> ${buildNoteDateFieldHtml()}</p>`,
      '<p><strong>Team:</strong> </p>',
      '<h3>Gestern erledigt</h3>',
      BULLET_LIST('', ''),
      '<h3>Heute geplant</h3>',
      BULLET_LIST('', ''),
      '<h3>Blocker</h3>',
      BULLET_LIST('Keine'),
      '<h3>Parkplatz</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'workshop',
    groupKey: 'meetings',
    titleKey: 'notes.templates.workshop.title',
    descriptionKey: 'notes.templates.workshop.description',
    bodyHtml: [
      '<h2>Workshop</h2>',
      '<p><strong>Thema:</strong> </p>',
      '<p><strong>Datum / Ort:</strong> </p>',
      '<p><strong>Moderation:</strong> </p>',
      '<h3>Ziel des Workshops</h3>',
      '<p></p>',
      '<h3>Teilnehmer</h3>',
      BULLET_LIST('', ''),
      '<h3>Agenda</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Ideen &amp; Ergebnisse</h3>',
      '<p></p>',
      '<h3>Entscheidungen</h3>',
      BULLET_LIST('', ''),
      '<h3>Nächste Schritte</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'project',
    groupKey: 'projects',
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
    id: 'sprintRetro',
    groupKey: 'projects',
    titleKey: 'notes.templates.sprintRetro.title',
    descriptionKey: 'notes.templates.sprintRetro.description',
    bodyHtml: [
      '<h2>Sprint-Retrospektive</h2>',
      '<p><strong>Sprint:</strong> </p>',
      '<p><strong>Datum:</strong> </p>',
      '<h3>Was lief gut?</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Was können wir verbessern?</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Experiment / Action Items</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Stimmung im Team</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'decisionLog',
    groupKey: 'projects',
    titleKey: 'notes.templates.decisionLog.title',
    descriptionKey: 'notes.templates.decisionLog.description',
    bodyHtml: [
      '<h2>Entscheidungsprotokoll</h2>',
      '<p><strong>Entscheidung:</strong> </p>',
      '<p><strong>Datum:</strong> </p>',
      '<p><strong>Entscheider:</strong> </p>',
      '<h3>Kontext</h3>',
      '<p></p>',
      '<h3>Optionen</h3>',
      BULLET_LIST('Option A: ', 'Option B: '),
      '<h3>Begründung</h3>',
      '<p></p>',
      '<h3>Auswirkungen</h3>',
      '<p></p>',
      '<h3>Review-Termin</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'riskRegister',
    groupKey: 'projects',
    titleKey: 'notes.templates.riskRegister.title',
    descriptionKey: 'notes.templates.riskRegister.description',
    bodyHtml: [
      '<h2>Risikoregister</h2>',
      '<p><strong>Projekt / Bereich:</strong> </p>',
      '<p><strong>Stand:</strong> </p>',
      '<h3>Risiko 1</h3>',
      '<p><strong>Beschreibung:</strong> </p>',
      '<p><strong>Wahrscheinlichkeit:</strong> niedrig / mittel / hoch</p>',
      '<p><strong>Auswirkung:</strong> niedrig / mittel / hoch</p>',
      '<p><strong>Gegenmaßnahme:</strong> </p>',
      '<p><strong>Verantwortlich:</strong> </p>',
      '<h3>Risiko 2</h3>',
      '<p><strong>Beschreibung:</strong> </p>',
      '<p><strong>Wahrscheinlichkeit:</strong> </p>',
      '<p><strong>Auswirkung:</strong> </p>',
      '<p><strong>Gegenmaßnahme:</strong> </p>',
      '<h3>Beobachtete Frühwarnzeichen</h3>',
      BULLET_LIST('', '')
    ].join('')
  },
  {
    id: 'weekly',
    groupKey: 'productivity',
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
    id: 'weeklyOverview',
    groupKey: 'productivity',
    titleKey: 'notes.templates.weeklyOverview.title',
    descriptionKey: 'notes.templates.weeklyOverview.description',
    bodyHtml: ''
  },
  {
    id: 'monthlyOverview',
    groupKey: 'productivity',
    titleKey: 'notes.templates.monthlyOverview.title',
    descriptionKey: 'notes.templates.monthlyOverview.description',
    bodyHtml: ''
  },
  {
    id: 'monthlyFitnessTracker',
    groupKey: 'productivity',
    titleKey: 'notes.templates.monthlyFitnessTracker.title',
    descriptionKey: 'notes.templates.monthlyFitnessTracker.description',
    bodyHtml: ''
  },
  {
    id: 'weeklyTimetable',
    groupKey: 'productivity',
    titleKey: 'notes.templates.weeklyTimetable.title',
    descriptionKey: 'notes.templates.weeklyTimetable.description',
    bodyHtml: ''
  },
  {
    id: 'studentAttendanceList',
    groupKey: 'people',
    titleKey: 'notes.templates.studentAttendanceList.title',
    descriptionKey: 'notes.templates.studentAttendanceList.description',
    bodyHtml: ''
  },
  {
    id: 'dailyPlanner',
    groupKey: 'productivity',
    titleKey: 'notes.templates.dailyPlanner.title',
    descriptionKey: 'notes.templates.dailyPlanner.description',
    bodyHtml: ''
  },
  {
    id: 'dailyReview',
    groupKey: 'productivity',
    titleKey: 'notes.templates.dailyReview.title',
    descriptionKey: 'notes.templates.dailyReview.description',
    bodyHtml: [
      '<h2>Tagesrückblick</h2>',
      '<p><strong>Datum:</strong> </p>',
      '<h3>Morgen — Intention</h3>',
      '<p>Heute ist wichtig: </p>',
      '<h3>Erledigt</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Offen geblieben</h3>',
      BULLET_LIST('', ''),
      '<h3>Abend — Reflexion</h3>',
      '<p>Was lief gut? </p>',
      '<p>Was nehme ich mit? </p>',
      '<p>Dankbar für: </p>'
    ].join('')
  },
  {
    id: 'okr',
    groupKey: 'productivity',
    titleKey: 'notes.templates.okr.title',
    descriptionKey: 'notes.templates.okr.description',
    bodyHtml: [
      '<h2>OKR / Quartalsziele</h2>',
      '<p><strong>Quartal:</strong> </p>',
      '<h3>Objective 1</h3>',
      '<p><strong>Ziel:</strong> </p>',
      '<p><strong>Key Result 1:</strong> </p>',
      '<p><strong>Key Result 2:</strong> </p>',
      '<p><strong>Key Result 3:</strong> </p>',
      '<h3>Objective 2</h3>',
      '<p><strong>Ziel:</strong> </p>',
      '<p><strong>Key Result 1:</strong> </p>',
      '<p><strong>Key Result 2:</strong> </p>',
      '<h3>Fortschritt &amp; Blocker</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'habitTracker',
    groupKey: 'productivity',
    titleKey: 'notes.templates.habitTracker.title',
    descriptionKey: 'notes.templates.habitTracker.description',
    bodyHtml: [
      '<h2>Gewohnheits-Tracker</h2>',
      '<p><strong>Woche:</strong> </p>',
      '<h3>Gewohnheit 1</h3>',
      '<p><strong>Ziel:</strong> z. B. 3× Sport pro Woche</p>',
      TASK_LIST(TASK_ITEM('Mo'), TASK_ITEM('Di'), TASK_ITEM('Mi'), TASK_ITEM('Do'), TASK_ITEM('Fr')),
      '<h3>Gewohnheit 2</h3>',
      '<p><strong>Ziel:</strong> </p>',
      TASK_LIST(TASK_ITEM('Mo'), TASK_ITEM('Di'), TASK_ITEM('Mi'), TASK_ITEM('Do'), TASK_ITEM('Fr')),
      '<h3>Reflexion</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'checklist',
    groupKey: 'lists',
    titleKey: 'notes.templates.checklist.title',
    descriptionKey: 'notes.templates.checklist.description',
    bodyHtml: TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''))
  },
  {
    id: 'packingList',
    groupKey: 'lists',
    titleKey: 'notes.templates.packingList.title',
    descriptionKey: 'notes.templates.packingList.description',
    bodyHtml: [
      '<h2>Packliste</h2>',
      '<p><strong>Reiseziel:</strong> </p>',
      '<p><strong>Zeitraum:</strong> </p>',
      '<h3>Kleidung</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Technik</h3>',
      TASK_LIST(TASK_ITEM('Ladegerät'), TASK_ITEM('Kopfhörer'), TASK_ITEM('')),
      '<h3>Dokumente</h3>',
      TASK_LIST(TASK_ITEM('Ausweis / Reisepass'), TASK_ITEM('Tickets'), TASK_ITEM('')),
      '<h3>Sonstiges</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'readingNotes',
    groupKey: 'lists',
    titleKey: 'notes.templates.readingNotes.title',
    descriptionKey: 'notes.templates.readingNotes.description',
    bodyHtml: [
      '<h2>Lese-Notizen</h2>',
      '<p><strong>Titel:</strong> </p>',
      '<p><strong>Autor:</strong> </p>',
      '<p><strong>Status:</strong> gelesen / in Arbeit / geplant</p>',
      '<h3>Kernaussage</h3>',
      '<p></p>',
      '<h3>Wichtige Zitate</h3>',
      BULLET_LIST('„…“', '„…“'),
      '<h3>Erkenntnisse für mich</h3>',
      BULLET_LIST('', ''),
      '<h3>Umsetzen</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'recipe',
    groupKey: 'lists',
    titleKey: 'notes.templates.recipe.title',
    descriptionKey: 'notes.templates.recipe.description',
    bodyHtml: [
      '<h2>Rezept</h2>',
      '<p><strong>Gericht:</strong> </p>',
      '<p><strong>Portionen:</strong> </p>',
      '<p><strong>Zubereitungszeit:</strong> </p>',
      '<h3>Zutaten</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Zubereitung</h3>',
      BULLET_LIST('Schritt 1: ', 'Schritt 2: ', 'Schritt 3: '),
      '<h3>Tipps &amp; Variationen</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'tripPlan',
    groupKey: 'events',
    titleKey: 'notes.templates.tripPlan.title',
    descriptionKey: 'notes.templates.tripPlan.description',
    bodyHtml: [
      '<h2>Reiseplan</h2>',
      '<p><strong>Ziel:</strong> </p>',
      '<p><strong>Zeitraum:</strong> </p>',
      '<p><strong>Budget:</strong> </p>',
      '<h3>Anreise &amp; Abreise</h3>',
      '<p></p>',
      '<h3>Unterkunft</h3>',
      '<p></p>',
      '<h3>Tagesplan</h3>',
      BULLET_LIST('Tag 1: ', 'Tag 2: ', 'Tag 3: '),
      '<h3>Reservierungen &amp; Buchungsnummern</h3>',
      BULLET_LIST('', ''),
      '<h3>Noch zu erledigen</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'eventPlan',
    groupKey: 'events',
    titleKey: 'notes.templates.eventPlan.title',
    descriptionKey: 'notes.templates.eventPlan.description',
    bodyHtml: [
      '<h2>Event-Planung</h2>',
      '<p><strong>Event:</strong> </p>',
      '<p><strong>Datum / Ort:</strong> </p>',
      '<p><strong>Gästezahl:</strong> </p>',
      '<h3>Ziel &amp; Stimmung</h3>',
      '<p></p>',
      '<h3>Timeline</h3>',
      BULLET_LIST('Aufbau: ', 'Beginn: ', 'Programm: ', 'Ende: '),
      '<h3>Catering &amp; Ausstattung</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM('')),
      '<h3>Kommunikation</h3>',
      BULLET_LIST('Einladung: ', 'Erinnerung: '),
      '<h3>Notfallplan</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'contactProfile',
    groupKey: 'people',
    titleKey: 'notes.templates.contactProfile.title',
    descriptionKey: 'notes.templates.contactProfile.description',
    bodyHtml: [
      '<h2>Kontaktprofil</h2>',
      '<p><strong>Name:</strong> </p>',
      '<p><strong>Rolle / Firma:</strong> </p>',
      '<p><strong>E-Mail / Telefon:</strong> </p>',
      '<h3>Beziehung &amp; Kontext</h3>',
      '<p></p>',
      '<h3>Wichtige Fakten</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Letzte Gespräche</h3>',
      BULLET_LIST('', ''),
      '<h3>Nächste Schritte</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'interviewNotes',
    groupKey: 'people',
    titleKey: 'notes.templates.interviewNotes.title',
    descriptionKey: 'notes.templates.interviewNotes.description',
    bodyHtml: [
      '<h2>Interview-Protokoll</h2>',
      '<p><strong>Kandidat / Gesprächspartner:</strong> </p>',
      '<p><strong>Position / Anlass:</strong> </p>',
      '<p><strong>Datum:</strong> </p>',
      '<h3>Stärken</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Offene Fragen</h3>',
      BULLET_LIST('', ''),
      '<h3>Eindruck</h3>',
      '<p></p>',
      '<h3>Entscheidung / Nächster Schritt</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'feedback360',
    groupKey: 'people',
    titleKey: 'notes.templates.feedback360.title',
    descriptionKey: 'notes.templates.feedback360.description',
    bodyHtml: [
      '<h2>Feedback-Session</h2>',
      '<p><strong>Für:</strong> </p>',
      '<p><strong>Von:</strong> </p>',
      '<p><strong>Datum:</strong> </p>',
      '<h3>Was läuft gut?</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Was könnte besser sein?</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Konkrete Beispiele</h3>',
      '<p></p>',
      '<h3>Vereinbarte nächste Schritte</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'bugReport',
    groupKey: 'tech',
    titleKey: 'notes.templates.bugReport.title',
    descriptionKey: 'notes.templates.bugReport.description',
    bodyHtml: [
      '<h2>Bug-Report</h2>',
      '<p><strong>Titel:</strong> </p>',
      '<p><strong>Priorität:</strong> kritisch / hoch / mittel / niedrig</p>',
      '<p><strong>Umgebung:</strong> Browser / OS / Version</p>',
      '<h3>Erwartetes Verhalten</h3>',
      '<p></p>',
      '<h3>Tatsächliches Verhalten</h3>',
      '<p></p>',
      '<h3>Schritte zur Reproduktion</h3>',
      BULLET_LIST('1. ', '2. ', '3. '),
      '<h3>Logs / Screenshots</h3>',
      '<p></p>'
    ].join('')
  },
  {
    id: 'apiDesign',
    groupKey: 'tech',
    titleKey: 'notes.templates.apiDesign.title',
    descriptionKey: 'notes.templates.apiDesign.description',
    bodyHtml: [
      '<h2>Feature-Spec / API-Design</h2>',
      '<p><strong>Feature:</strong> </p>',
      '<p><strong>Status:</strong> Entwurf / Review / umgesetzt</p>',
      '<h3>Problem &amp; Ziel</h3>',
      '<p></p>',
      '<h3>Anforderungen</h3>',
      BULLET_LIST('Muss: ', 'Soll: ', 'Kann: '),
      '<h3>API / Schnittstelle</h3>',
      '<p><strong>Endpoint:</strong> </p>',
      '<p><strong>Request:</strong> </p>',
      '<p><strong>Response:</strong> </p>',
      '<h3>Offene Fragen</h3>',
      BULLET_LIST('', ''),
      '<h3>Akzeptanzkriterien</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
  },
  {
    id: 'incidentReport',
    groupKey: 'tech',
    titleKey: 'notes.templates.incidentReport.title',
    descriptionKey: 'notes.templates.incidentReport.description',
    bodyHtml: [
      '<h2>Incident Postmortem</h2>',
      '<p><strong>Incident-ID:</strong> </p>',
      '<p><strong>Zeitraum:</strong> </p>',
      '<p><strong>Schweregrad:</strong> </p>',
      '<h3>Zusammenfassung</h3>',
      '<p></p>',
      '<h3>Timeline</h3>',
      BULLET_LIST('', '', ''),
      '<h3>Ursache (Root Cause)</h3>',
      '<p></p>',
      '<h3>Was hat geholfen?</h3>',
      BULLET_LIST('', ''),
      '<h3>Action Items</h3>',
      TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''))
    ].join('')
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
      builtin: true,
      groupKey: builtin.groupKey
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
    builtin: true,
    groupKey: fallback.groupKey
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

export function listBuiltinNotePageTemplateGroups(
  customTemplates: readonly { id: string; name: string; description: string; bodyHtml: string }[],
  translate: (key: string) => string
): NotePageTemplateGroup[] {
  const resolved = listAllNotePageTemplates(customTemplates, translate).filter((template) => template.builtin)
  return NOTE_PAGE_TEMPLATE_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: translate(`notes.templates.groups.${groupKey}`),
    templates: resolved.filter((template) => template.groupKey === groupKey)
  })).filter((group) => group.templates.length > 0)
}
