import type { UserNoteKind } from '@shared/types'
import type { NotesShellView } from '@/app/notes/NotesShellViewToggle'
import {
  isTimeGridSlotMinutes,
  TIME_GRID_SLOT_MINUTES_OPTIONS,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import {
  isNotesPagesSortKey,
  NOTES_PAGES_SORT_KEYS,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import type { NotesSidebarListMode } from '@/lib/notes-sidebar-storage'
import type { NotesSectionsNavScope } from '@/lib/notes-nav-selection'
import type { NotePageTemplateId } from '@/lib/note-page-templates'
import { normalizeNotePageTemplateId } from '@/lib/note-page-templates-custom'
import {
  DEFAULT_NOTE_AUDIO_RECORDING_QUALITY,
  isNoteAudioRecordingQuality,
  type NoteAudioRecordingQuality
} from '@shared/note-audio-quality'

export type NotesLinkedPreviewPlacement = 'dock' | 'float'
export type NotesAutosaveMode = 'off' | 'on_change' | 'on_leave' | 'interval'
export type NotesDateFilterMode = 'none' | 'current_month' | 'scheduled_only'
export type NotesKindsFilter = 'all' | 'standalone_only'
export type NotesSearchLimit = 20 | 30 | 50
export type NotesListLimit = 200 | 500 | 1000

const STORAGE_KEY = 'mailclient.notes.settingsPrefs.v1'

export type NotesWeekStart = 0 | 1
export type NotesCalendarDateMode = 'created' | 'scheduled'

export interface NotesSettingsPrefsV1 {
  defaultShellView: NotesShellView
  rememberLastShellView: boolean
  /** Beim Wechsel zurück in Notizen die zuletzt geöffnete Seite wieder laden. */
  rememberLastOpenNote: boolean
  defaultSidebarListMode: NotesSidebarListMode
  defaultSectionsNavScope: NotesSectionsNavScope
  rememberLastNavSelection: boolean
  defaultPagesSort: NotesPagesSortKey
  defaultCalendarFcView: string
  defaultCalendarDateMode: NotesCalendarDateMode
  rememberLastCalendarFcView: boolean
  useMainCalendarDisplaySettings: boolean
  weekStartsOn: NotesWeekStart
  defaultTimeGridSlotMinutes: TimeGridSlotMinutes
  slotMinTime: string
  slotMaxTime: string
  scrollTime: string
  hideWeekends: boolean
  defaultLinkedPreviewOpen: boolean
  defaultLinkedPreviewPlacement: NotesLinkedPreviewPlacement
  defaultLinkedPreviewDockWidth: number
  defaultFloatPreviewWidth: number
  defaultFloatPreviewHeight: number
  defaultDetailColumnWidth: number
  useGlobalModuleNavWidth: boolean
  defaultNavColumnWidth: number
  entityContextCollapsedDefault: boolean
  defaultEditorHeight: number
  defaultNotePageTemplateId: NotePageTemplateId
  showSectionLabelsInPages: boolean
  defaultAccountsCollapsed: boolean
  searchResultLimit: NotesSearchLimit
  notesListFetchLimit: NotesListLimit
  defaultNoteKindsFilter: NotesKindsFilter
  defaultDateFilterMode: NotesDateFilterMode
  autosaveMode: NotesAutosaveMode
  autosaveIntervalSeconds: 30 | 60 | 120
  openNoteAfterCreate: boolean
  scheduleBlockExpandedDefault: boolean
  defaultScheduleDurationMinutes: number
  audioRecordingQuality: NoteAudioRecordingQuality
}

export const NOTES_SETTINGS_PREFS_CHANGED_EVENT = 'mailclient:notes-settings-prefs-changed'

const VALID_FC_VIEWS = new Set([
  'dayGridMonth',
  'dayGridWeek',
  'timeGridWeek',
  'timeGridDay',
  'listWeek',
  ...Array.from({ length: 20 }, (_, i) => `timeGrid${i + 2}Day`)
])

const DEFAULTS: NotesSettingsPrefsV1 = {
  defaultShellView: 'list',
  rememberLastShellView: true,
  rememberLastOpenNote: true,
  defaultSidebarListMode: 'sections',
  defaultSectionsNavScope: 'ungrouped',
  rememberLastNavSelection: true,
  defaultPagesSort: 'manual',
  defaultCalendarFcView: 'dayGridMonth',
  defaultCalendarDateMode: 'created',
  rememberLastCalendarFcView: true,
  useMainCalendarDisplaySettings: false,
  weekStartsOn: 1,
  defaultTimeGridSlotMinutes: 30,
  slotMinTime: '07:00:00',
  slotMaxTime: '20:00:00',
  scrollTime: '07:00:00',
  hideWeekends: false,
  defaultLinkedPreviewOpen: false,
  defaultLinkedPreviewPlacement: 'dock',
  defaultLinkedPreviewDockWidth: 360,
  defaultFloatPreviewWidth: 420,
  defaultFloatPreviewHeight: 480,
  defaultDetailColumnWidth: 300,
  useGlobalModuleNavWidth: false,
  defaultNavColumnWidth: 256,
  entityContextCollapsedDefault: true,
  defaultEditorHeight: 420,
  defaultNotePageTemplateId: 'blank',
  showSectionLabelsInPages: false,
  defaultAccountsCollapsed: false,
  searchResultLimit: 30,
  notesListFetchLimit: 500,
  defaultNoteKindsFilter: 'all',
  defaultDateFilterMode: 'none',
  autosaveMode: 'on_change',
  autosaveIntervalSeconds: 60,
  openNoteAfterCreate: true,
  scheduleBlockExpandedDefault: false,
  defaultScheduleDurationMinutes: 30,
  audioRecordingQuality: DEFAULT_NOTE_AUDIO_RECORDING_QUALITY
}

function normalizeTimeHms(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const s = raw.trim()
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 5 ? `${s}:00` : s
  }
  return fallback
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function parseSectionsNavScope(raw: unknown): NotesSectionsNavScope | null {
  if (raw === 'all' || raw === 'ungrouped') return raw
  if (raw && typeof raw === 'object' && 'sectionId' in raw) {
    const sectionId = (raw as { sectionId: unknown }).sectionId
    if (typeof sectionId === 'number' && sectionId > 0) return { sectionId }
  }
  return null
}

function migrateLegacyPrefs(base: NotesSettingsPrefsV1): NotesSettingsPrefsV1 {
  try {
    const listMode = window.localStorage.getItem('mailclient.notes.sidebarListMode')
    if (listMode === 'accounts' || listMode === 'sections') {
      base.defaultSidebarListMode = listMode
    }
    const sort = window.localStorage.getItem('mailclient.notes.pagesSort.v1')?.trim()
    if (sort && isNotesPagesSortKey(sort)) base.defaultPagesSort = sort
    const calView = window.localStorage.getItem('mailclient.notes.calendar.fcView.v1')?.trim()
    if (calView && VALID_FC_VIEWS.has(calView)) base.defaultCalendarFcView = calView
    const dm = window.localStorage.getItem('mailclient.notes.calendarDateMode.v1')
    if (dm === 'scheduled') base.defaultCalendarDateMode = 'scheduled'
    if (dm === 'created') base.defaultCalendarDateMode = 'created'
    if (window.localStorage.getItem('mailclient.notesShell.linkedPreviewOpen') === '1') {
      base.defaultLinkedPreviewOpen = true
    }
    const placement = window.localStorage.getItem('mailclient.notesShell.linkedPreviewPlacement')
    if (placement === 'float') base.defaultLinkedPreviewPlacement = 'float'
    const floatSize = window.localStorage.getItem('mailclient.notesShell.floatPreviewSize')
    if (floatSize) {
      try {
        const p = JSON.parse(floatSize) as { w?: unknown; h?: unknown }
        if (typeof p.w === 'number') base.defaultFloatPreviewWidth = clampInt(p.w, 300, 900, base.defaultFloatPreviewWidth)
        if (typeof p.h === 'number') base.defaultFloatPreviewHeight = clampInt(p.h, 280, 900, base.defaultFloatPreviewHeight)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return base
}

function parsePrefs(raw: string): NotesSettingsPrefsV1 {
  const o = JSON.parse(raw) as Record<string, unknown>
  const base = { ...DEFAULTS }
  if (o.defaultShellView === 'list' || o.defaultShellView === 'calendar') {
    base.defaultShellView = o.defaultShellView
  }
  if (typeof o.rememberLastShellView === 'boolean') base.rememberLastShellView = o.rememberLastShellView
  if (typeof o.rememberLastOpenNote === 'boolean') base.rememberLastOpenNote = o.rememberLastOpenNote
  if (o.defaultSidebarListMode === 'accounts' || o.defaultSidebarListMode === 'sections') {
    base.defaultSidebarListMode = o.defaultSidebarListMode
  }
  const scope = parseSectionsNavScope(o.defaultSectionsNavScope)
  if (scope) base.defaultSectionsNavScope = scope
  if (typeof o.rememberLastNavSelection === 'boolean') {
    base.rememberLastNavSelection = o.rememberLastNavSelection
  }
  if (typeof o.defaultPagesSort === 'string' && isNotesPagesSortKey(o.defaultPagesSort)) {
    base.defaultPagesSort = o.defaultPagesSort
  }
  if (typeof o.defaultCalendarFcView === 'string' && VALID_FC_VIEWS.has(o.defaultCalendarFcView)) {
    base.defaultCalendarFcView = o.defaultCalendarFcView
  }
  if (o.defaultCalendarDateMode === 'created' || o.defaultCalendarDateMode === 'scheduled') {
    base.defaultCalendarDateMode = o.defaultCalendarDateMode
  }
  if (typeof o.rememberLastCalendarFcView === 'boolean') {
    base.rememberLastCalendarFcView = o.rememberLastCalendarFcView
  }
  if (typeof o.useMainCalendarDisplaySettings === 'boolean') {
    base.useMainCalendarDisplaySettings = o.useMainCalendarDisplaySettings
  }
  if (o.weekStartsOn === 0 || o.weekStartsOn === 1) base.weekStartsOn = o.weekStartsOn
  const slotN = Number(o.defaultTimeGridSlotMinutes)
  if (Number.isInteger(slotN) && isTimeGridSlotMinutes(slotN)) {
    base.defaultTimeGridSlotMinutes = slotN
  }
  base.slotMinTime = normalizeTimeHms(o.slotMinTime, base.slotMinTime)
  base.slotMaxTime = normalizeTimeHms(o.slotMaxTime, base.slotMaxTime)
  base.scrollTime = normalizeTimeHms(o.scrollTime, base.scrollTime)
  if (typeof o.hideWeekends === 'boolean') base.hideWeekends = o.hideWeekends
  if (typeof o.defaultLinkedPreviewOpen === 'boolean') {
    base.defaultLinkedPreviewOpen = o.defaultLinkedPreviewOpen
  }
  if (o.defaultLinkedPreviewPlacement === 'dock' || o.defaultLinkedPreviewPlacement === 'float') {
    base.defaultLinkedPreviewPlacement = o.defaultLinkedPreviewPlacement
  }
  base.defaultLinkedPreviewDockWidth = clampInt(
    o.defaultLinkedPreviewDockWidth,
    260,
    720,
    base.defaultLinkedPreviewDockWidth
  )
  base.defaultFloatPreviewWidth = clampInt(
    o.defaultFloatPreviewWidth,
    300,
    900,
    base.defaultFloatPreviewWidth
  )
  base.defaultFloatPreviewHeight = clampInt(
    o.defaultFloatPreviewHeight,
    280,
    900,
    base.defaultFloatPreviewHeight
  )
  base.defaultDetailColumnWidth = clampInt(o.defaultDetailColumnWidth, 220, 480, base.defaultDetailColumnWidth)
  if (typeof o.useGlobalModuleNavWidth === 'boolean') {
    base.useGlobalModuleNavWidth = o.useGlobalModuleNavWidth
  }
  base.defaultNavColumnWidth = clampInt(o.defaultNavColumnWidth, 180, 480, base.defaultNavColumnWidth)
  if (typeof o.entityContextCollapsedDefault === 'boolean') {
    base.entityContextCollapsedDefault = o.entityContextCollapsedDefault
  }
  base.defaultEditorHeight = clampInt(o.defaultEditorHeight, 240, 800, base.defaultEditorHeight)
  if (typeof o.defaultNotePageTemplateId === 'string') {
    base.defaultNotePageTemplateId = normalizeNotePageTemplateId(o.defaultNotePageTemplateId)
  }
  if (typeof o.showSectionLabelsInPages === 'boolean') {
    base.showSectionLabelsInPages = o.showSectionLabelsInPages
  }
  if (typeof o.defaultAccountsCollapsed === 'boolean') {
    base.defaultAccountsCollapsed = o.defaultAccountsCollapsed
  }
  if (o.searchResultLimit === 20 || o.searchResultLimit === 30 || o.searchResultLimit === 50) {
    base.searchResultLimit = o.searchResultLimit
  }
  if (o.notesListFetchLimit === 200 || o.notesListFetchLimit === 500 || o.notesListFetchLimit === 1000) {
    base.notesListFetchLimit = o.notesListFetchLimit
  }
  if (o.defaultNoteKindsFilter === 'all' || o.defaultNoteKindsFilter === 'standalone_only') {
    base.defaultNoteKindsFilter = o.defaultNoteKindsFilter
  }
  if (
    o.defaultDateFilterMode === 'none' ||
    o.defaultDateFilterMode === 'current_month' ||
    o.defaultDateFilterMode === 'scheduled_only'
  ) {
    base.defaultDateFilterMode = o.defaultDateFilterMode
  }
  if (
    o.autosaveMode === 'off' ||
    o.autosaveMode === 'on_change' ||
    o.autosaveMode === 'on_leave' ||
    o.autosaveMode === 'interval'
  ) {
    base.autosaveMode = o.autosaveMode
  }
  if (o.autosaveIntervalSeconds === 30 || o.autosaveIntervalSeconds === 60 || o.autosaveIntervalSeconds === 120) {
    base.autosaveIntervalSeconds = o.autosaveIntervalSeconds
  }
  if (typeof o.openNoteAfterCreate === 'boolean') base.openNoteAfterCreate = o.openNoteAfterCreate
  if (typeof o.scheduleBlockExpandedDefault === 'boolean') {
    base.scheduleBlockExpandedDefault = o.scheduleBlockExpandedDefault
  }
  base.defaultScheduleDurationMinutes = clampInt(
    o.defaultScheduleDurationMinutes,
    15,
    480,
    base.defaultScheduleDurationMinutes
  )
  if (isNoteAudioRecordingQuality(o.audioRecordingQuality)) {
    base.audioRecordingQuality = o.audioRecordingQuality
  }
  return base
}

export function readNotesSettingsPrefs(): NotesSettingsPrefsV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return parsePrefs(raw)
    return migrateLegacyPrefs({ ...DEFAULTS })
  } catch {
    return { ...DEFAULTS }
  }
}

export function persistNotesSettingsPrefs(prefs: NotesSettingsPrefsV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(NOTES_SETTINGS_PREFS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function patchNotesSettingsPrefs(patch: Partial<NotesSettingsPrefsV1>): NotesSettingsPrefsV1 {
  const next = { ...readNotesSettingsPrefs(), ...patch }
  persistNotesSettingsPrefs(next)
  return next
}

export function resetNotesSettingsPrefs(): void {
  persistNotesSettingsPrefs({ ...DEFAULTS })
}

export function isValidNotesCalendarFcView(viewId: string): boolean {
  return VALID_FC_VIEWS.has(viewId)
}

export function noteKindsForFilter(filter: NotesKindsFilter): UserNoteKind[] {
  return filter === 'standalone_only' ? ['standalone'] : ['mail', 'calendar', 'standalone']
}

export const NOTES_CALENDAR_FC_VIEW_OPTIONS = [
  'dayGridMonth',
  'dayGridWeek',
  'timeGridWeek',
  'timeGridDay',
  'listWeek'
] as const

export { TIME_GRID_SLOT_MINUTES_OPTIONS, NOTES_PAGES_SORT_KEYS }
export type { NoteAudioRecordingQuality } from '@shared/note-audio-quality'
