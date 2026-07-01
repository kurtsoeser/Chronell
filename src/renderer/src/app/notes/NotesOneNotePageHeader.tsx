import { memo, useEffect, useState, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNote } from '@shared/types'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { NotesCategoryBadges } from '@/components/NotesCategoryBadges'
import { NotesAttachmentsPanel } from '@/app/notes/NotesAttachmentsPanel'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import { noteKindLabel } from '@/app/notes/notes-display-helpers'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { cn } from '@/lib/utils'

function OneNoteMetaDot(): JSX.Element {
  return (
    <span className="text-muted-foreground/40" aria-hidden>
      ·
    </span>
  )
}

function OneNoteMetaRow({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        'grid grid-cols-[6.5rem_minmax(0,1fr)] border-b border-border/50 last:border-b-0',
        className
      )}
    >
      <div className="flex items-start justify-end bg-muted/50 px-2 py-2 text-right text-xs italic text-muted-foreground">
        {label}
      </div>
      <div className="min-h-[2.25rem] bg-background px-2 py-1.5 text-sm text-foreground">{children}</div>
    </div>
  )
}

function toLocalDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toLocalTimeInput(iso: string | null): string {
  if (!iso) return '09:00'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '09:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineLocalDateTime(date: string, time: string): string | null {
  if (!date.trim()) return null
  const t = time.trim() || '09:00'
  const d = new Date(`${date}T${t}:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export interface NotesOneNotePageHeaderProps {
  note: UserNote
  categories: string[]
  categoryColorByName: Map<string, string>
  sectionName: string | null
  initialTitle: string
  onTitleChange: (title: string) => void
  disabled?: boolean
  breadcrumb?: Array<{ id: number; title: string | null }>
  onBreadcrumbNavigate?: (noteId: number) => void
  onOpenCategories: (anchor: { x: number; y: number }) => void
  onOpenSection: (anchor: { x: number; y: number }) => void
  onIconChange: (iconId: string | undefined) => void
  onIconColorChange: (iconColor: string | null) => void
  scheduleNote: Pick<UserNote, 'scheduledStartIso' | 'scheduledEndIso' | 'scheduledAllDay'>
  defaultScheduleDurationMinutes?: number
  onScheduleChange: (value: {
    scheduledStartIso: string | null
    scheduledEndIso: string | null
    scheduledAllDay: boolean
    clearSchedule?: boolean
  }) => void
  noteId: number
}

export const NotesOneNotePageHeader = memo(function NotesOneNotePageHeader({
  note,
  categories,
  categoryColorByName,
  sectionName,
  initialTitle,
  onTitleChange,
  disabled = false,
  breadcrumb,
  onBreadcrumbNavigate,
  onOpenCategories,
  onOpenSection,
  onIconChange,
  onIconColorChange,
  scheduleNote,
  defaultScheduleDurationMinutes = 30,
  onScheduleChange,
  noteId
}: NotesOneNotePageHeaderProps): JSX.Element {
  const { t } = useTranslation()
  const [titleDraft, setTitleDraft] = useState(initialTitle)

  const pageDateIso = scheduleNote.scheduledStartIso ?? note.createdAt

  const [dateYmd, setDateYmd] = useState(() => toLocalDateInput(pageDateIso))
  const [dateTime, setDateTime] = useState(() => toLocalTimeInput(pageDateIso))

  const hasSchedule = Boolean(scheduleNote.scheduledStartIso)
  const [scheduleDateYmd, setScheduleDateYmd] = useState(() =>
    hasSchedule ? toLocalDateInput(scheduleNote.scheduledStartIso) : ''
  )
  const [scheduleTimeHm, setScheduleTimeHm] = useState(() =>
    hasSchedule && !scheduleNote.scheduledAllDay
      ? toLocalTimeInput(scheduleNote.scheduledStartIso)
      : ''
  )

  useEffect(() => {
    setDateYmd(toLocalDateInput(pageDateIso))
    setDateTime(toLocalTimeInput(pageDateIso))
  }, [pageDateIso])

  useEffect(() => {
    const scheduled = Boolean(scheduleNote.scheduledStartIso)
    setScheduleDateYmd(scheduled ? toLocalDateInput(scheduleNote.scheduledStartIso) : '')
    setScheduleTimeHm(
      scheduled && !scheduleNote.scheduledAllDay
        ? toLocalTimeInput(scheduleNote.scheduledStartIso)
        : ''
    )
  }, [scheduleNote.scheduledStartIso, scheduleNote.scheduledAllDay])

  function applyPageDate(nextDate: string, nextTime: string): void {
    const startIso = combineLocalDateTime(nextDate, nextTime)
    if (!startIso) return
    const endD = new Date(startIso)
    endD.setMinutes(endD.getMinutes() + defaultScheduleDurationMinutes)
    onScheduleChange({
      scheduledStartIso: startIso,
      scheduledEndIso: endD.toISOString(),
      scheduledAllDay: false
    })
  }

  function applySchedule(nextDate: string, nextTime: string): void {
    const date = nextDate.trim() || toLocalDateInput(new Date().toISOString())
    const time =
      nextTime.trim() ||
      (scheduleNote.scheduledAllDay ? '09:00' : toLocalTimeInput(new Date().toISOString()))
    if (scheduleNote.scheduledAllDay) {
      onScheduleChange({
        scheduledStartIso: date,
        scheduledEndIso: date,
        scheduledAllDay: true
      })
      return
    }
    const startIso = combineLocalDateTime(date, time)
    if (!startIso) return
    const endD = new Date(startIso)
    endD.setMinutes(endD.getMinutes() + defaultScheduleDurationMinutes)
    onScheduleChange({
      scheduledStartIso: startIso,
      scheduledEndIso: endD.toISOString(),
      scheduledAllDay: false
    })
  }

  function clearSchedule(): void {
    onScheduleChange({
      scheduledStartIso: null,
      scheduledEndIso: null,
      scheduledAllDay: false,
      clearSchedule: true
    })
  }

  return (
    <header className="note-onenote-page-header shrink-0">
      {breadcrumb && breadcrumb.length > 1 ? (
        <nav
          className="mb-2 flex min-w-0 flex-wrap items-center gap-1 text-2xs text-muted-foreground"
          aria-label={t('notes.shell.breadcrumb')}
        >
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 ? <span aria-hidden>/</span> : null}
              <button
                type="button"
                className={cn(
                  'max-w-[12rem] truncate hover:text-foreground hover:underline',
                  index === breadcrumb.length - 1 && 'font-medium text-foreground'
                )}
                onClick={(): void => onBreadcrumbNavigate?.(crumb.id)}
              >
                {crumb.title?.trim() || t('notes.shell.untitled')}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex items-start gap-2 border-b border-foreground/20 pb-1">
        <CalendarEventIconPicker
          layout="compact"
          openOn="click"
          iconId={note.iconId}
          iconColorHex={resolveEntityIconColor(note.iconColor)}
          title={titleDraft.trim() || t('notes.shell.untitled')}
          disabled={disabled}
          triggerIcon={<NoteDisplayIcon note={note} className="h-5 w-5" />}
          compactButtonClassName="mt-1"
          onIconChange={onIconChange}
          footer={
            <IconColorPickerFooter
              iconColor={note.iconColor}
              onIconColorChange={onIconColorChange}
            />
          }
        />
        <input
          type="text"
          value={titleDraft}
          onChange={(e): void => {
            const next = e.target.value
            setTitleDraft(next)
            onTitleChange(next)
          }}
          placeholder={t('notes.shell.titlePlaceholder')}
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-3xl font-normal tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0"
          aria-label={t('notes.shell.titlePlaceholder')}
        />
      </div>

      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <ChronellDateField
          variant="inline"
          value={dateYmd}
          disabled={disabled}
          aria-label={t('notes.onenote.pageDateEdit')}
          onChange={(next): void => {
            setDateYmd(next)
            applyPageDate(next, dateTime)
          }}
        />
        <OneNoteMetaDot />
        <ChronellTimeField
          variant="inline"
          value={dateTime}
          disabled={disabled}
          aria-label={t('notes.onenote.pageTimeEdit')}
          onChange={(next): void => {
            setDateTime(next)
            applyPageDate(dateYmd, next)
          }}
        />
        <OneNoteMetaDot />
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
          <span className="shrink-0 text-xs italic text-muted-foreground">
            {t('notes.onenote.metaSection')}:
          </span>
          <button
            type="button"
            disabled={disabled}
            className="min-w-0 text-left hover:underline"
            onClick={(e): void => onOpenSection({ x: e.clientX, y: e.clientY + 8 })}
          >
            {sectionName?.trim() ? (
              <span className="truncate">{sectionName}</span>
            ) : (
              <span className="text-muted-foreground">{t('notes.onenote.sectionEmpty')}</span>
            )}
          </button>
        </span>
        <OneNoteMetaDot />
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-xs italic text-muted-foreground">
            {t('notes.onenote.metaKind')}:
          </span>
          <span className="text-muted-foreground">{noteKindLabel(note, t)}</span>
        </span>
        <OneNoteMetaDot />
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
          <span className="shrink-0 text-xs italic text-muted-foreground">
            {t('notes.onenote.metaCategories')}:
          </span>
          <button
            type="button"
            disabled={disabled}
            className="min-w-0 text-left"
            onClick={(e): void => onOpenCategories({ x: e.clientX, y: e.clientY + 8 })}
          >
            {categories.length > 0 ? (
              <NotesCategoryBadges names={categories} colorByName={categoryColorByName} />
            ) : (
              <span className="text-muted-foreground">{t('notes.onenote.categoriesEmpty')}</span>
            )}
          </button>
        </span>
        <OneNoteMetaDot />
        <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <span className="shrink-0 text-xs italic text-muted-foreground">
            {t('notes.onenote.metaSchedule')}:
          </span>
          <ChronellDateField
            variant="inline"
            value={scheduleDateYmd}
            disabled={disabled}
            aria-label={t('notes.onenote.scheduleDateEdit')}
            onChange={(next): void => {
              setScheduleDateYmd(next)
              applySchedule(next, scheduleTimeHm)
            }}
          />
          {!scheduleNote.scheduledAllDay ? (
            <>
              <OneNoteMetaDot />
              <ChronellTimeField
                variant="inline"
                value={scheduleTimeHm}
                disabled={disabled}
                aria-label={t('notes.onenote.scheduleTimeEdit')}
                onChange={(next): void => {
                  setScheduleTimeHm(next)
                  applySchedule(scheduleDateYmd, next)
                }}
              />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">({t('notes.schedule.allDay')})</span>
          )}
          {hasSchedule ? (
            <button
              type="button"
              disabled={disabled}
              className="ml-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={clearSchedule}
            >
              {t('common.remove')}
            </button>
          ) : null}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-sm border border-border/60 bg-muted/30">
        <OneNoteMetaRow label={t('notes.onenote.metaAttachments')} className="border-b-0">
          <NotesAttachmentsPanel noteId={noteId} variant="onenote" />
        </OneNoteMetaRow>
      </div>
    </header>
  )
})
