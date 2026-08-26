import { Plus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PEOPLE_PHONE_KINDS,
  normalizePhoneKind,
  type PeoplePhoneEntry,
  type PeoplePhoneKind
} from '@/app/people/people-contact-json'
import { cn } from '@/lib/utils'

const phoneKindLabelKey: Record<PeoplePhoneKind, string> = {
  mobile: 'people.shell.phoneTypeMobile',
  home: 'people.shell.phoneTypeHome',
  business: 'people.shell.phoneTypeBusiness',
  other: 'people.shell.phoneTypeOther'
}

interface PeoplePhoneFieldsEditorProps {
  phones: PeoplePhoneEntry[]
  onChange: (next: PeoplePhoneEntry[]) => void
  disabled?: boolean
  className?: string
}

export function PeoplePhoneFieldsEditor({
  phones,
  onChange,
  disabled = false,
  className
}: PeoplePhoneFieldsEditorProps): JSX.Element {
  const { t } = useTranslation()
  const addTypeRef = useRef<PeoplePhoneKind>('mobile')

  const fieldClass = 'mt-0.5 w-full rounded border border-border bg-card px-2 py-1.5'

  function updateRow(index: number, patch: Partial<PeoplePhoneEntry>): void {
    onChange(phones.map((entry, rowIndex) => (rowIndex === index ? { ...entry, ...patch } : entry)))
  }

  function removeRow(index: number): void {
    onChange(phones.filter((_, rowIndex) => rowIndex !== index))
  }

  function addRow(): void {
    onChange([...phones, { type: addTypeRef.current, value: '' }])
  }

  return (
    <div className={cn('space-y-2', className)}>
      <span className="text-xs font-medium text-muted-foreground">{t('people.shell.phone')}</span>
      {phones.length === 0 ? (
        <p className="text-xs text-muted-foreground/80">{t('people.shell.phoneEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {phones.map((entry, index) => (
            <li key={`phone-row-${index}`} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-[8.5rem] flex-1">
                <span className="sr-only">{t('people.shell.phoneTypeLabel')}</span>
                <select
                  className={fieldClass}
                  value={normalizePhoneKind(entry.type)}
                  disabled={disabled}
                  onChange={(e): void =>
                    updateRow(index, { type: e.target.value as PeoplePhoneKind })
                  }
                >
                  {PEOPLE_PHONE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(phoneKindLabelKey[kind])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0 flex-[2]">
                <span className="sr-only">{t('people.shell.phoneNumberLabel')}</span>
                <input
                  type="tel"
                  className={fieldClass}
                  value={entry.value}
                  disabled={disabled}
                  placeholder="+43 …"
                  onChange={(e): void => updateRow(index, { value: e.target.value })}
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                aria-label={t('people.shell.phoneRemove')}
                onClick={(): void => removeRow(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          ref={(node): void => {
            if (!node) return
            addTypeRef.current = normalizePhoneKind(node.value)
          }}
          className="rounded border border-border bg-card px-2 py-1.5 text-xs"
          defaultValue="mobile"
          disabled={disabled}
          aria-label={t('people.shell.phoneAddTypeLabel')}
          onChange={(e): void => {
            addTypeRef.current = normalizePhoneKind(e.target.value)
          }}
        >
          {PEOPLE_PHONE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(phoneKindLabelKey[kind])}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          onClick={(): void => addRow()}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('people.shell.phoneAdd')}
        </button>
      </div>
    </div>
  )
}
