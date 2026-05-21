import { useMemo, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'
import {
  persistNotesCalendarFcView,
  readNotesCalendarFcView
} from '@/app/notes/notes-calendar-view-storage'
import {
  persistNotesLinkedPreviewOpen,
  persistNotesLinkedPreviewPlacement,
  readNotesLinkedPreviewOpen,
  readNotesLinkedPreviewPlacement,
  type NotesLinkedPreviewPlacement
} from '@/app/notes/notes-shell-storage'
import {
  NOTES_PAGES_SORT_KEYS,
  notesPagesSortLabelKey,
  persistNotesPagesSort,
  readNotesPagesSort,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import {
  persistNotesSidebarListMode,
  readNotesSidebarListMode,
  type NotesSidebarListMode
} from '@/lib/notes-sidebar-storage'

const NOTES_CALENDAR_DEFAULT_VIEWS = [
  'dayGridMonth',
  'timeGridWeek',
  'timeGridDay',
  'listWeek'
] as const

export interface AccountSetupNotesPanelProps {
  section: string
  onClose: () => void
}

/** Einstellungen → Notizen (eigener Chunk). */
export default function AccountSetupNotesPanel({
  section,
  onClose
}: AccountSetupNotesPanelProps): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)

  const [sidebarListMode, setSidebarListMode] = useState<NotesSidebarListMode>(() =>
    readNotesSidebarListMode()
  )
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())
  const [calendarDefaultView, setCalendarDefaultView] = useState(() => readNotesCalendarFcView())
  const [linkedPreviewOpen, setLinkedPreviewOpen] = useState(() => readNotesLinkedPreviewOpen())
  const [linkedPreviewPlacement, setLinkedPreviewPlacement] = useState<NotesLinkedPreviewPlacement>(
    () => readNotesLinkedPreviewPlacement()
  )

  const calendarViewOptions = useMemo(() => {
    const base = [...NOTES_CALENDAR_DEFAULT_VIEWS]
    if (!base.includes(calendarDefaultView as (typeof NOTES_CALENDAR_DEFAULT_VIEWS)[number])) {
      return [calendarDefaultView, ...base]
    }
    return base
  }, [calendarDefaultView])

  return (
    <div role="tabpanel" aria-label={t('settings.notesPanelAria')} className="space-y-5">
      {section === 'workspace' && (
        <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            {t('settings.notesWorkspaceHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesWorkspaceIntro')}</p>
          <button
            type="button"
            onClick={(): void => {
              setAppMode('notes')
              onClose()
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {t('settings.notesOpenModule')}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{t('settings.notesMoreComingHint')}</p>
        </section>
      )}

      {section === 'sidebar' && (
        <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesSidebarHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesSidebarListModeHint')}</p>
          <label htmlFor="notes-settings-sidebar-mode" className="block text-[11px] font-medium text-foreground">
            {t('settings.notesSidebarListModeLabel')}
          </label>
          <select
            id="notes-settings-sidebar-mode"
            value={sidebarListMode}
            onChange={(e): void => {
              const mode = e.target.value as NotesSidebarListMode
              setSidebarListMode(mode)
              persistNotesSidebarListMode(mode)
            }}
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          >
            <option value="accounts">{t('settings.notesSidebarListModeAccounts')}</option>
            <option value="sections">{t('settings.notesSidebarListModeSections')}</option>
          </select>
        </section>
      )}

      {section === 'pages' && (
        <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesPagesHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesPagesSortHint')}</p>
          <label htmlFor="notes-settings-pages-sort" className="block text-[11px] font-medium text-foreground">
            {t('settings.notesPagesSortLabel')}
          </label>
          <select
            id="notes-settings-pages-sort"
            value={pagesSort}
            onChange={(e): void => {
              const key = e.target.value as NotesPagesSortKey
              setPagesSort(key)
              persistNotesPagesSort(key)
            }}
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          >
            {NOTES_PAGES_SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(notesPagesSortLabelKey(key))}
              </option>
            ))}
          </select>
        </section>
      )}

      {section === 'calendar' && (
        <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesCalendarHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesCalendarDefaultViewHint')}</p>
          <label
            htmlFor="notes-settings-cal-view"
            className="block text-[11px] font-medium text-foreground"
          >
            {t('settings.notesCalendarDefaultViewLabel')}
          </label>
          <select
            id="notes-settings-cal-view"
            value={calendarDefaultView}
            onChange={(e): void => {
              const viewId = e.target.value
              setCalendarDefaultView(viewId)
              persistNotesCalendarFcView(viewId)
            }}
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          >
            {calendarViewOptions.map((viewId) => (
              <option key={viewId} value={viewId}>
                {viewIdToLabel(viewId, t)}
              </option>
            ))}
          </select>
        </section>
      )}

      {section === 'linked' && (
        <section className="space-y-3 rounded-md border border-border/35 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesLinkedHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesLinkedHint')}</p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={linkedPreviewOpen}
              onChange={(e): void => {
                const open = e.target.checked
                setLinkedPreviewOpen(open)
                persistNotesLinkedPreviewOpen(open)
              }}
              className="h-3.5 w-3.5 rounded border-border"
            />
            {t('settings.notesLinkedPreviewOpenLabel')}
          </label>
          <div>
            <label htmlFor="notes-settings-linked-placement" className="block text-[11px] font-medium text-foreground">
              {t('settings.notesLinkedPreviewPlacementLabel')}
            </label>
            <select
              id="notes-settings-linked-placement"
              value={linkedPreviewPlacement}
              disabled={!linkedPreviewOpen}
              onChange={(e): void => {
                const placement = e.target.value as NotesLinkedPreviewPlacement
                setLinkedPreviewPlacement(placement)
                persistNotesLinkedPreviewPlacement(placement)
              }}
              className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring disabled:opacity-50"
            >
              <option value="dock">{t('settings.notesLinkedPreviewDock')}</option>
              <option value="float">{t('settings.notesLinkedPreviewFloat')}</option>
            </select>
          </div>
        </section>
      )}
    </div>
  )
}
