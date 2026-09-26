import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare } from 'lucide-react'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'

export const CalendarEventDialogSubjectRow = memo(function CalendarEventDialogSubjectRow({
  mode,
  isTaskCreate,
  subject,
  eventIconId,
  eventFieldsLocked,
  onSubjectChange,
  onIconChange
}: {
  mode: 'create' | 'edit'
  isTaskCreate: boolean
  subject: string
  eventIconId: string | undefined
  eventFieldsLocked: boolean
  onSubjectChange: (value: string) => void
  onIconChange: (iconId: string | undefined) => void
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-stretch gap-2">
      {mode === 'create' && isTaskCreate ? (
        <CheckSquare className="my-auto h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <CalendarEventIconPicker
          layout="compact"
          iconId={eventIconId}
          title={subject}
          disabled={eventFieldsLocked}
          onIconChange={onIconChange}
          compactButtonClassName="h-12 w-12"
          compactIconClassName="h-7 w-7"
        />
      )}
      <input
        type="text"
        value={subject}
        onChange={(e): void => onSubjectChange(e.target.value)}
        disabled={eventFieldsLocked}
        placeholder={
          mode === 'create' && isTaskCreate
            ? t('calendar.eventDialog.taskTitlePlaceholder')
            : t('calendar.eventDialog.titlePlaceholder')
        }
        aria-label={t('calendar.eventDialog.titleAria')}
        className="min-w-0 flex-1 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-2 text-[17px] font-semibold leading-snug text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  )
})
