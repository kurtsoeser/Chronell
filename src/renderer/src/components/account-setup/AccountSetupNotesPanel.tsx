import { useCallback, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'
import {
  isTimeGridSlotMinutes,
  TIME_GRID_SLOT_MINUTES_OPTIONS
} from '@/app/calendar/calendar-shell-storage'
import type { NotesSectionsNavScope } from '@/lib/notes-nav-selection'
import {
  NOTES_CALENDAR_FC_VIEW_OPTIONS,
  NOTES_PAGES_SORT_KEYS,
  patchNotesSettingsPrefs,
  resetNotesSettingsPrefs,
  type NoteAudioRecordingQuality,
  type NotesSettingsPrefsV1
} from '@/lib/notes-settings-prefs'
import { NOTE_AUDIO_RECORDING_QUALITIES } from '@shared/note-audio-quality'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { notesPagesSortLabelKey } from '@/lib/notes-pages-sort'
import {
  useComposeEditorThemeStore,
  type ComposeEditorTheme
} from '@/stores/compose-editor-theme'
import type { NotesSidebarListMode } from '@/lib/notes-sidebar-storage'
import type { NotesShellView } from '@/app/notes/NotesShellViewToggle'
import type {
  NotesAutosaveMode,
  NotesDateFilterMode,
  NotesKindsFilter,
  NotesLinkedPreviewPlacement,
  NotesListLimit,
  NotesSearchLimit
} from '@/lib/notes-settings-prefs'
import { listAllNotePageTemplates, type NotePageTemplateId } from '@/lib/note-page-templates'
import { NotePageTemplatesManager } from '@/components/NotePageTemplatesManager'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return { value: `${pad(h)}:00:00`, label: `${pad(h)}:00` }
})

function SettingsField({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {hint ? <span className="block text-2xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  )
}

export interface AccountSetupNotesPanelProps {
  section: string
  onClose: () => void
}

/** Einstellungen → Notizen */
export default function AccountSetupNotesPanel({
  section,
  onClose
}: AccountSetupNotesPanelProps): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const prefs = useNotesSettingsPrefs()
  const { customTemplates } = useCustomNotePageTemplates()
  const templateOptions = listAllNotePageTemplates(customTemplates, t)
  const editorThemePref = useComposeEditorThemeStore((s) => s.preference)
  const setEditorThemePref = useComposeEditorThemeStore((s) => s.setPreference)
  const editorThemeValue = editorThemePref ?? 'app'
  const [, bump] = useState(0)
  const refresh = useCallback((): void => bump((n) => n + 1), [])

  const apply = useCallback(
    (patch: Partial<NotesSettingsPrefsV1>): void => {
      patchNotesSettingsPrefs(patch)
      refresh()
    },
    [refresh]
  )

  const selectClass =
    'w-full max-w-md rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring'

  return (
    <div role="tabpanel" aria-label={t('settings.notesPanelAria')} className="space-y-5">
      {section === 'workspace' && (
        <section className="space-y-2 rounded-md bg-background/60 p-3">
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
        </section>
      )}

      {section === 'display' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesDisplayHeading')}
          </h3>

          <SettingsField label={t('settings.notesDefaultShellViewLabel')} hint={t('settings.notesDefaultShellViewHint')}>
            <select
              value={prefs.defaultShellView}
              onChange={(e): void => apply({ defaultShellView: e.target.value as NotesShellView })}
              className={selectClass}
            >
              <option value="list">{t('notes.shell.viewList')}</option>
              <option value="calendar">{t('notes.shell.viewCalendar')}</option>
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.rememberLastShellView}
              onChange={(e): void => apply({ rememberLastShellView: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.notesRememberShellViewLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.notesRememberShellViewHint')}
              </span>
            </span>
          </label>

          <SettingsField
            label={t('settings.notesDetailWidthLabel')}
            hint={t('settings.notesDetailWidthHint')}
          >
            <input
              type="range"
              min={220}
              max={480}
              step={10}
              value={prefs.defaultDetailColumnWidth}
              onChange={(e): void =>
                apply({ defaultDetailColumnWidth: Number(e.target.value) })
              }
              className="w-full max-w-md"
            />
            <span className="text-2xs text-muted-foreground">{prefs.defaultDetailColumnWidth} px</span>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.entityContextCollapsedDefault}
              onChange={(e): void => apply({ entityContextCollapsedDefault: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesEntityContextCollapsedLabel')}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.useGlobalModuleNavWidth}
              onChange={(e): void => apply({ useGlobalModuleNavWidth: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesUseGlobalNavWidthLabel')}</span>
          </label>
          {!prefs.useGlobalModuleNavWidth ? (
            <SettingsField label={t('settings.notesNavWidthLabel')}>
              <input
                type="range"
                min={180}
                max={480}
                step={8}
                value={prefs.defaultNavColumnWidth}
                onChange={(e): void => apply({ defaultNavColumnWidth: Number(e.target.value) })}
                className="w-full max-w-md"
              />
              <span className="text-2xs text-muted-foreground">{prefs.defaultNavColumnWidth} px</span>
            </SettingsField>
          ) : null}
        </section>
      )}

      {section === 'editor' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesEditorHeading')}
          </h3>

          <SettingsField label={t('settings.notesEditorHeightLabel')}>
            <input
              type="range"
              min={240}
              max={800}
              step={20}
              value={prefs.defaultEditorHeight}
              onChange={(e): void => apply({ defaultEditorHeight: Number(e.target.value) })}
              className="w-full max-w-md"
            />
            <span className="text-2xs text-muted-foreground">{prefs.defaultEditorHeight} px</span>
          </SettingsField>

          <SettingsField
            label={t('settings.notesEditorThemeLabel')}
            hint={t('settings.notesEditorThemeHint')}
          >
            <select
              value={editorThemeValue}
              onChange={(e): void => {
                const v = e.target.value
                setEditorThemePref(v === 'app' ? null : (v as ComposeEditorTheme))
              }}
              className={selectClass}
            >
              <option value="app">{t('settings.mailCompose.editorThemeApp')}</option>
              <option value="light">{t('settings.mailCompose.editorThemeLight')}</option>
              <option value="dark">{t('settings.mailCompose.editorThemeDark')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.notesDefaultTemplateLabel')}>
            <select
              value={prefs.defaultNotePageTemplateId}
              onChange={(e): void =>
                apply({ defaultNotePageTemplateId: e.target.value as NotePageTemplateId })
              }
              className={selectClass}
            >
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </SettingsField>

          <NotePageTemplatesManager className="rounded-md border border-border/60 bg-muted/10 p-3" />

          <SettingsField
            label={t('settings.notesAudioQualityLabel')}
            hint={t('settings.notesAudioQualityHint')}
          >
            <select
              value={prefs.audioRecordingQuality}
              onChange={(e): void =>
                apply({ audioRecordingQuality: e.target.value as NoteAudioRecordingQuality })
              }
              className={selectClass}
            >
              {NOTE_AUDIO_RECORDING_QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {t(`settings.notesAudioQuality_${quality}`)}
                </option>
              ))}
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.showSectionLabelsInPages}
              onChange={(e): void => apply({ showSectionLabelsInPages: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesShowSectionLabelsLabel')}</span>
          </label>
        </section>
      )}

      {section === 'sidebar' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesSidebarHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesSidebarListModeHint')}</p>

          <SettingsField label={t('settings.notesSidebarListModeLabel')}>
            <select
              value={prefs.defaultSidebarListMode}
              onChange={(e): void =>
                apply({ defaultSidebarListMode: e.target.value as NotesSidebarListMode })
              }
              className={selectClass}
            >
              <option value="accounts">{t('settings.notesSidebarListModeAccounts')}</option>
              <option value="sections">{t('settings.notesSidebarListModeSections')}</option>
            </select>
          </SettingsField>

          {prefs.defaultSidebarListMode === 'sections' ? (
            <SettingsField label={t('settings.notesDefaultSectionScopeLabel')}>
              <select
                value={
                  prefs.defaultSectionsNavScope === 'all'
                    ? 'all'
                    : prefs.defaultSectionsNavScope === 'ungrouped'
                      ? 'ungrouped'
                      : 'ungrouped'
                }
                onChange={(e): void =>
                  apply({
                    defaultSectionsNavScope: e.target.value as NotesSectionsNavScope
                  })
                }
                className={selectClass}
              >
                <option value="ungrouped">{t('settings.notesDefaultSectionUngrouped')}</option>
                <option value="all">{t('settings.notesDefaultSectionAll')}</option>
              </select>
            </SettingsField>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.rememberLastNavSelection}
              onChange={(e): void => apply({ rememberLastNavSelection: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesRememberNavLabel')}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultAccountsCollapsed}
              onChange={(e): void => apply({ defaultAccountsCollapsed: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesAccountsCollapsedLabel')}</span>
          </label>
        </section>
      )}

      {section === 'pages' && (
        <section className="space-y-2 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesPagesHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesPagesSortHint')}</p>
          <SettingsField label={t('settings.notesPagesSortLabel')}>
            <select
              value={prefs.defaultPagesSort}
              onChange={(e): void => {
                const key = e.target.value
                if (NOTES_PAGES_SORT_KEYS.includes(key as (typeof NOTES_PAGES_SORT_KEYS)[number])) {
                  apply({ defaultPagesSort: key as NotesSettingsPrefsV1['defaultPagesSort'] })
                }
              }}
              className={selectClass}
            >
              {NOTES_PAGES_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(notesPagesSortLabelKey(key))}
                </option>
              ))}
            </select>
          </SettingsField>
        </section>
      )}

      {section === 'calendar' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesCalendarHeading')}
          </h3>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.useMainCalendarDisplaySettings}
              onChange={(e): void => apply({ useMainCalendarDisplaySettings: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.notesUseMainCalendarLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.notesUseMainCalendarHint')}
              </span>
            </span>
          </label>

          <SettingsField
            label={t('settings.notesCalendarDefaultViewLabel')}
            hint={t('settings.notesCalendarDefaultViewHint')}
          >
            <select
              value={prefs.defaultCalendarFcView}
              onChange={(e): void => apply({ defaultCalendarFcView: e.target.value })}
              className={selectClass}
            >
              {NOTES_CALENDAR_FC_VIEW_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {viewIdToLabel(v, t)}
                </option>
              ))}
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.rememberLastCalendarFcView}
              onChange={(e): void => apply({ rememberLastCalendarFcView: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.notesRememberCalendarViewLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.notesRememberCalendarViewHint')}
              </span>
            </span>
          </label>

          {!prefs.useMainCalendarDisplaySettings ? (
            <>
              <SettingsField label={t('settings.notesCalendarWeekStartLabel')}>
                <select
                  value={String(prefs.weekStartsOn)}
                  onChange={(e): void =>
                    apply({ weekStartsOn: Number(e.target.value) as NotesSettingsPrefsV1['weekStartsOn'] })
                  }
                  className={selectClass}
                >
                  <option value="1">{t('settings.calendarWeekStartMonday')}</option>
                  <option value="0">{t('settings.calendarWeekStartSunday')}</option>
                </select>
              </SettingsField>

              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={prefs.hideWeekends}
                  onChange={(e): void => apply({ hideWeekends: e.target.checked })}
                  className="mt-0.5"
                />
                <span className="font-medium">{t('settings.calendarHideWeekendsLabel')}</span>
              </label>

              <SettingsField label={t('settings.calendarSlotMinutesLabel')}>
                <select
                  value={prefs.defaultTimeGridSlotMinutes}
                  onChange={(e): void => {
                    const n = Number(e.target.value)
                    if (isTimeGridSlotMinutes(n)) apply({ defaultTimeGridSlotMinutes: n })
                  }}
                  className={selectClass}
                >
                  {TIME_GRID_SLOT_MINUTES_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {t('calendar.header.slotMinutesOption', { count: m })}
                    </option>
                  ))}
                </select>
              </SettingsField>

              <div className="grid gap-3 sm:grid-cols-3">
                <SettingsField label={t('settings.calendarSlotMinLabel')}>
                  <select
                    value={prefs.slotMinTime}
                    onChange={(e): void => apply({ slotMinTime: e.target.value })}
                    className={selectClass}
                  >
                    {HOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </SettingsField>
                <SettingsField label={t('settings.calendarSlotMaxLabel')}>
                  <select
                    value={prefs.slotMaxTime}
                    onChange={(e): void => apply({ slotMaxTime: e.target.value })}
                    className={selectClass}
                  >
                    {HOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </SettingsField>
                <SettingsField label={t('settings.calendarScrollTimeLabel')}>
                  <select
                    value={prefs.scrollTime}
                    onChange={(e): void => apply({ scrollTime: e.target.value })}
                    className={selectClass}
                  >
                    {HOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </SettingsField>
              </div>
            </>
          ) : null}
        </section>
      )}

      {section === 'linked' && (
        <section className="space-y-3 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesLinkedHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.notesLinkedHint')}</p>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultLinkedPreviewOpen}
              onChange={(e): void => apply({ defaultLinkedPreviewOpen: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesLinkedPreviewOpenLabel')}</span>
          </label>
          <SettingsField label={t('settings.notesLinkedPreviewPlacementLabel')}>
            <select
              value={prefs.defaultLinkedPreviewPlacement}
              disabled={!prefs.defaultLinkedPreviewOpen}
              onChange={(e): void =>
                apply({
                  defaultLinkedPreviewPlacement: e.target.value as NotesLinkedPreviewPlacement
                })
              }
              className={selectClass}
            >
              <option value="dock">{t('settings.notesLinkedPreviewDock')}</option>
              <option value="float">{t('settings.notesLinkedPreviewFloat')}</option>
            </select>
          </SettingsField>

          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label={t('settings.notesPreviewDockWidthLabel')}>
              <input
                type="range"
                min={260}
                max={720}
                step={10}
                value={prefs.defaultLinkedPreviewDockWidth}
                onChange={(e): void =>
                  apply({ defaultLinkedPreviewDockWidth: Number(e.target.value) })
                }
                className="w-full"
              />
            </SettingsField>
            <SettingsField label={t('settings.notesPreviewFloatWidthLabel')}>
              <input
                type="range"
                min={300}
                max={900}
                step={10}
                value={prefs.defaultFloatPreviewWidth}
                onChange={(e): void => apply({ defaultFloatPreviewWidth: Number(e.target.value) })}
                className="w-full"
              />
            </SettingsField>
          </div>
          <SettingsField label={t('settings.notesPreviewFloatHeightLabel')}>
            <input
              type="range"
              min={280}
              max={900}
              step={10}
              value={prefs.defaultFloatPreviewHeight}
              onChange={(e): void => apply({ defaultFloatPreviewHeight: Number(e.target.value) })}
              className="w-full max-w-md"
            />
          </SettingsField>
        </section>
      )}

      {section === 'workflow' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.notesWorkflowHeading')}
          </h3>

          <SettingsField label={t('settings.notesAutosaveLabel')}>
            <select
              value={prefs.autosaveMode}
              onChange={(e): void => apply({ autosaveMode: e.target.value as NotesAutosaveMode })}
              className={selectClass}
            >
              <option value="on_change">{t('settings.notesAutosaveOnChange')}</option>
              <option value="off">{t('settings.notesAutosaveOff')}</option>
              <option value="on_leave">{t('settings.notesAutosaveOnLeave')}</option>
              <option value="interval">{t('settings.notesAutosaveInterval')}</option>
            </select>
          </SettingsField>

          {prefs.autosaveMode === 'interval' ? (
            <SettingsField label={t('settings.notesAutosaveIntervalLabel')}>
              <select
                value={prefs.autosaveIntervalSeconds}
                onChange={(e): void =>
                  apply({
                    autosaveIntervalSeconds: Number(e.target.value) as 30 | 60 | 120
                  })
                }
                className={selectClass}
              >
                <option value={30}>30 s</option>
                <option value={60}>60 s</option>
                <option value={120}>120 s</option>
              </select>
            </SettingsField>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.openNoteAfterCreate}
              onChange={(e): void => apply({ openNoteAfterCreate: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesOpenAfterCreateLabel')}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.scheduleBlockExpandedDefault}
              onChange={(e): void => apply({ scheduleBlockExpandedDefault: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.notesScheduleExpandedLabel')}</span>
          </label>

          <SettingsField label={t('settings.notesScheduleDurationLabel')}>
            <select
              value={prefs.defaultScheduleDurationMinutes}
              onChange={(e): void =>
                apply({ defaultScheduleDurationMinutes: Number(e.target.value) })
              }
              className={selectClass}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.notesDateFilterLabel')}>
            <select
              value={prefs.defaultDateFilterMode}
              onChange={(e): void =>
                apply({ defaultDateFilterMode: e.target.value as NotesDateFilterMode })
              }
              className={selectClass}
            >
              <option value="none">{t('settings.notesDateFilterNone')}</option>
              <option value="current_month">{t('settings.notesDateFilterMonth')}</option>
              <option value="scheduled_only">{t('settings.notesDateFilterScheduled')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.notesKindsFilterLabel')}>
            <select
              value={prefs.defaultNoteKindsFilter}
              onChange={(e): void =>
                apply({ defaultNoteKindsFilter: e.target.value as NotesKindsFilter })
              }
              className={selectClass}
            >
              <option value="all">{t('settings.notesKindsAll')}</option>
              <option value="standalone_only">{t('settings.notesKindsStandalone')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.notesSearchLimitLabel')}>
            <select
              value={prefs.searchResultLimit}
              onChange={(e): void =>
                apply({ searchResultLimit: Number(e.target.value) as NotesSearchLimit })
              }
              className={selectClass}
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.notesListLimitLabel')}>
            <select
              value={prefs.notesListFetchLimit}
              onChange={(e): void =>
                apply({ notesListFetchLimit: Number(e.target.value) as NotesListLimit })
              }
              className={selectClass}
            >
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </SettingsField>
        </section>
      )}

      <div className="px-1">
        <button
          type="button"
          onClick={(): void => {
            resetNotesSettingsPrefs()
            refresh()
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('settings.notesResetAll')}
        </button>
      </div>
    </div>
  )
}
