import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  listBuiltinNotePageTemplateGroups,
  type NotePageTemplateId,
  type NotePlannerTemplateKind
} from '@/lib/note-page-templates'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass
} from '@/components/ModuleColumnHeader'
import { NotePlannerTemplateDialog } from '@/app/notes/NotePlannerTemplateDialog'
import {
  NotePageTemplatePreviewHover,
  type NotePageTemplatePreviewTarget
} from '@/components/NotePageTemplatePreviewHover'
import {
  buildInstantStructuredTemplateOverride,
  fitnessMetricColumnLetters,
  isInstantStructuredTemplateId,
  isParametricPlannerTemplateId,
  type NotePlannerBuildOptions
} from '@/lib/note-planner-templates'
import { resolveNotesCalendarDisplayPrefs } from '@/lib/notes-calendar-display'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import type { NotePageCreateOverride } from '@/lib/note-page-create'
import { cn } from '@/lib/utils'

const menuHeadingClass =
  'border-b border-border/50 px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground'
const groupHeadingClass = (firstInList: boolean): string =>
  cn(
    'px-3 pb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/60',
    firstInList ? 'pt-1.5' : 'pt-2.5'
  )
const templateTitleClass = 'text-xs font-medium leading-tight text-foreground'
const templateDescriptionClass = 'text-2xs leading-snug text-muted-foreground/85'

export function NotePageCreateMenu({
  onCreate,
  creating = false,
  disabled = false,
  buttonLabel,
  variant = 'icon'
}: {
  onCreate: (templateId: NotePageTemplateId, override?: NotePageCreateOverride) => void
  creating?: boolean
  disabled?: boolean
  buttonLabel?: string
  variant?: 'icon' | 'button'
}): JSX.Element {
  const { t } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const notesSettings = useNotesSettingsPrefs()
  const calDisplay = useMemo(
    () => resolveNotesCalendarDisplayPrefs(notesSettings),
    [notesSettings]
  )
  const { customTemplates } = useCustomNotePageTemplates()
  const builtinGroups = listBuiltinNotePageTemplateGroups(customTemplates, t)
  const customResolved = customTemplates.map((template) => ({
    id: template.id,
    title: template.name,
    description: template.description
  }))
  const [open, setOpen] = useState(false)
  const [plannerKind, setPlannerKind] = useState<NotePlannerTemplateKind | null>(null)
  const [previewTarget, setPreviewTarget] = useState<NotePageTemplatePreviewTarget | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const plannerOptions = useMemo(
    (): NotePlannerBuildOptions => ({
      weekStartsOn: calDisplay.weekStartsOn,
      slotMinTime: calDisplay.slotMinTime,
      slotMaxTime: calDisplay.slotMaxTime,
      slotMinutes: calDisplay.defaultTimeGridSlotMinutes,
      locale: dfLocale,
      labels: {
        weekShort: t('notes.plannerDialog.weekShort'),
        sectionGeneral: t('notes.plannerDialog.sectionGeneral'),
        sectionNotes: t('notes.plannerDialog.sectionNotes'),
        sectionTasks: t('notes.plannerDialog.sectionTasks'),
        sectionSchedule: t('notes.plannerDialog.sectionSchedule'),
        dayColumn: t('notes.plannerDialog.dayColumn'),
        fitnessTitlePrefix: t('notes.plannerDialog.fitnessTitlePrefix'),
        fitnessColumns: fitnessMetricColumnLetters(),
        weekdaysLong: [
          t('notes.plannerDialog.weekday.mon'),
          t('notes.plannerDialog.weekday.tue'),
          t('notes.plannerDialog.weekday.wed'),
          t('notes.plannerDialog.weekday.thu'),
          t('notes.plannerDialog.weekday.fri'),
          t('notes.plannerDialog.weekday.sat'),
          t('notes.plannerDialog.weekday.sun')
        ],
        dailyPlannerTitlePrefix: t('notes.dailyPlanner.titlePrefix'),
        dailyScheduleDay: `${calDisplay.slotMinTime.slice(0, 5)} – ${calDisplay.slotMaxTime.slice(0, 5)}`,
        dailyScheduleNight: t('notes.dailyPlanner.scheduleNight'),
        dailyChecklist: t('notes.dailyPlanner.checklist'),
        dailyPriority: t('notes.dailyPlanner.priority'),
        dailyAction: t('notes.dailyPlanner.action'),
        dailyPlainList: t('notes.dailyPlanner.plainList'),
        dailyGridNotes: t('notes.dailyPlanner.gridNotes'),
        dailyLinedNotes: t('notes.dailyPlanner.linedNotes'),
        dailyQuadrantNotes: t('notes.dailyPlanner.quadrantNotes')
      }
    }),
    [calDisplay, dfLocale, t]
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (templateId: NotePageTemplateId): void => {
    setOpen(false)
    if (isParametricPlannerTemplateId(templateId)) {
      setPlannerKind(templateId)
      return
    }
    if (isInstantStructuredTemplateId(templateId)) {
      onCreate(templateId, buildInstantStructuredTemplateOverride(templateId, t))
      return
    }
    onCreate(templateId)
  }

  useEffect(() => {
    if (!open) setPreviewTarget(null)
  }, [open])

  const renderTemplateButton = (template: {
    id: string
    title: string
    description?: string
  }): JSX.Element => (
    <div
      key={template.id}
      onMouseEnter={(e): void => {
        if (template.id === 'blank') return
        setPreviewTarget({
          templateId: template.id,
          title: template.title,
          anchorRect: e.currentTarget.getBoundingClientRect()
        })
      }}
      onMouseLeave={(): void => setPreviewTarget(null)}
    >
      <button
        type="button"
        role="menuitem"
        className="mx-1 flex w-[calc(100%-0.5rem)] flex-col items-start gap-0.5 rounded-sm px-2.5 py-1.5 text-left hover:bg-secondary/60"
        onClick={(): void => pick(template.id)}
      >
        <span className={templateTitleClass}>{template.title}</span>
        {template.description ? (
          <span className={cn(templateDescriptionClass, 'line-clamp-2')}>{template.description}</span>
        ) : null}
      </button>
    </div>
  )

  return (
    <div ref={rootRef} className="relative">
      {variant === 'icon' ? (
        <ModuleColumnHeaderIconButton
          type="button"
          onClick={(): void => setOpen((v) => !v)}
          disabled={disabled || creating}
          aria-label={t('notes.shell.newPage')}
          title={t('notes.shell.newPage')}
          aria-expanded={open}
        >
          {creating ? (
            <Loader2 className={cn(moduleColumnHeaderIconGlyphClass, 'animate-spin')} />
          ) : (
            <Plus className={moduleColumnHeaderIconGlyphClass} />
          )}
        </ModuleColumnHeaderIconButton>
      ) : (
        <button
          type="button"
          onClick={(): void => setOpen((v) => !v)}
          disabled={disabled || creating}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium'
          )}
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {buttonLabel ?? t('notes.shell.newPage')}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      )}

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-[min(420px,70vh)] min-w-[17.5rem] max-w-[20rem] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg',
            variant === 'icon' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          <div className={menuHeadingClass}>{t('notes.templates.menuHeading')}</div>
          {builtinGroups.map((group, groupIndex) => (
            <div key={group.key}>
              {groupIndex > 0 ? <div className="mx-3 my-0.5 border-t border-border/50" /> : null}
              <div className={groupHeadingClass(groupIndex === 0)}>{group.label}</div>
              {group.templates.map(renderTemplateButton)}
            </div>
          ))}
          {customResolved.length > 0 ? (
            <>
              <div className="mx-3 my-0.5 border-t border-border/50" />
              <div className={groupHeadingClass(false)}>{t('notes.templates.customSection')}</div>
              {customResolved.map(renderTemplateButton)}
            </>
          ) : null}
        </div>
      ) : null}

      {plannerKind ? (
        <NotePlannerTemplateDialog
          open
          kind={plannerKind}
          onClose={(): void => setPlannerKind(null)}
          onCreate={(result): void => {
            onCreate(plannerKind, result)
            setPlannerKind(null)
          }}
        />
      ) : null}

      <NotePageTemplatePreviewHover
        target={open ? previewTarget : null}
        customTemplates={customTemplates}
        plannerOptions={plannerOptions}
      />
    </div>
  )
}
