import { memo, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RecipientTokenField,
  type RecipientTokenFieldHandle
} from '@/components/RecipientTokenField'

export const CalendarEventDialogAttendeeField = memo(function CalendarEventDialogAttendeeField({
  fieldRef,
  label,
  value,
  onChange,
  accountId,
  eventFieldsLocked,
  pickContactsLabel
}: {
  fieldRef: Ref<RecipientTokenFieldHandle>
  label: string
  value: string
  onChange: (value: string) => void
  accountId: string
  eventFieldsLocked: boolean
  pickContactsLabel: string
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          disabled={eventFieldsLocked}
          onClick={(): void => {
            if (fieldRef && typeof fieldRef !== 'function' && fieldRef.current) {
              fieldRef.current.openContactPicker()
            }
          }}
          className="text-2xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {pickContactsLabel || t('calendar.eventDialog.attendeesPickContacts')}
        </button>
      </div>
      <div className="rounded-md border border-border bg-background px-2 py-1.5">
        <RecipientTokenField
          ref={fieldRef}
          hideLabelColumn
          label={label}
          value={value}
          onChange={onChange}
          accountId={accountId}
          className="border-0 px-0 py-0"
        />
      </div>
    </div>
  )
})
