import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, X } from 'lucide-react'
import type { MailImportance } from '@shared/types'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { cn } from '@/lib/utils'

export interface ComposeMessageOptionsValues {
  importance: MailImportance
  isReadReceiptRequested: boolean
  isDeliveryReceiptRequested: boolean
  smimeEncrypt: boolean
  smimeSign: boolean
  scheduledSendAt: string | null
}

interface Props {
  open: boolean
  isMicrosoft: boolean
  initial: ComposeMessageOptionsValues
  onClose: () => void
  onApply: (values: ComposeMessageOptionsValues) => void
}

export function ComposeMessageOptionsDialog({
  open,
  isMicrosoft,
  initial,
  onClose,
  onApply
}: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ComposeMessageOptionsValues>(initial)

  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])

  if (!open) return null

  const smimeSupported = false

  const handleOk = (): void => {
    if (!smimeSupported && (draft.smimeEncrypt || draft.smimeSign)) {
      setDraft((d) => ({ ...d, smimeEncrypt: false, smimeSign: false }))
      onApply({ ...draft, smimeEncrypt: false, smimeSign: false })
    } else {
      onApply(draft)
    }
    onClose()
  }

  return (
    <ModalRoot open zIndex={200} onBackdropClick={onClose}>
      <ModalPanel
        className="flex w-full max-w-[22rem] flex-col gap-4 p-4"
        aria-labelledby="compose-message-options-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="compose-message-options-title" className="text-sm font-semibold text-foreground">
            {t('mail.compose.messageOptionsTitle', { defaultValue: 'Nachrichtenoptionen' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close', { defaultValue: 'Schließen' })}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">
            {t('mail.compose.confidentiality', { defaultValue: 'Vertraulichkeit' })}
          </span>
          <select
            className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={draft.importance}
            onChange={(e): void =>
              setDraft((d) => ({
                ...d,
                importance: e.target.value as MailImportance
              }))
            }
          >
            <option value="normal">
              {t('mail.compose.confidentialityNormal', { defaultValue: 'Normal' })}
            </option>
            <option value="high">
              {t('mail.compose.confidentialityHigh', { defaultValue: 'Hoch' })}
            </option>
            <option value="low">
              {t('mail.compose.confidentialityLow', { defaultValue: 'Niedrig' })}
            </option>
          </select>
        </label>

        <div className="flex flex-col gap-2.5 text-xs">
          <OptionCheckbox
            checked={draft.isReadReceiptRequested}
            disabled={!isMicrosoft}
            label={t('mail.compose.requestReadReceipt', {
              defaultValue: 'Lesebestätigung anfordern'
            })}
            hint={
              !isMicrosoft
                ? t('mail.compose.microsoftOnlyHint', {
                    defaultValue: 'Nur für Microsoft 365-Konten.'
                  })
                : undefined
            }
            onChange={(v): void => setDraft((d) => ({ ...d, isReadReceiptRequested: v }))}
          />
          <OptionCheckbox
            checked={draft.isDeliveryReceiptRequested}
            disabled={!isMicrosoft}
            label={t('mail.compose.requestDeliveryReceipt', {
              defaultValue: 'Zustellungsbestätigung anfordern'
            })}
            hint={
              !isMicrosoft
                ? t('mail.compose.microsoftOnlyHint', {
                    defaultValue: 'Nur für Microsoft 365-Konten.'
                  })
                : undefined
            }
            onChange={(v): void => setDraft((d) => ({ ...d, isDeliveryReceiptRequested: v }))}
          />
          <OptionCheckbox
            checked={draft.smimeEncrypt}
            disabled={!smimeSupported}
            label={t('mail.compose.smimeEncrypt', {
              defaultValue: 'Diese Nachricht verschlüsseln (S/MIME)'
            })}
            hint={
              !smimeSupported
                ? t('mail.compose.smimeNotAvailable', {
                    defaultValue: 'S/MIME ist in Chronell noch nicht verfügbar.'
                  })
                : undefined
            }
            onChange={(v): void => setDraft((d) => ({ ...d, smimeEncrypt: v }))}
          />
          <OptionCheckbox
            checked={draft.smimeSign}
            disabled={!smimeSupported}
            label={t('mail.compose.smimeSign', {
              defaultValue: 'Diese Nachricht digital signieren (S/MIME)'
            })}
            hint={
              !smimeSupported
                ? t('mail.compose.smimeNotAvailable', {
                    defaultValue: 'S/MIME ist in Chronell noch nicht verfügbar.'
                  })
                : undefined
            }
            onChange={(v): void => setDraft((d) => ({ ...d, smimeSign: v }))}
          />
        </div>

        {isMicrosoft ? (
          <label className="flex flex-col gap-1 border-t border-border/60 pt-3 text-xs">
            <span className="text-muted-foreground">
              {t('mail.compose.scheduledSend', { defaultValue: 'Geplanter Versand' })}
            </span>
            <input
              type="datetime-local"
              value={draft.scheduledSendAt ?? ''}
              onChange={(e): void =>
                setDraft((d) => ({
                  ...d,
                  scheduledSendAt: e.target.value ? e.target.value : null
                }))
              }
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <span className="text-[10px] leading-snug text-muted-foreground">
              {t('mail.compose.scheduledSendHint', {
                defaultValue: 'Leer = sofort senden. Geplant nur ohne lokale Dateianhänge.'
              })}
            </span>
          </label>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {t('common.cancel', { defaultValue: 'Abbrechen' })}
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('common.ok', { defaultValue: 'OK' })}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}

function OptionCheckbox({
  checked,
  disabled,
  label,
  hint,
  onChange
}: {
  checked: boolean
  disabled?: boolean
  label: string
  hint?: string
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-0.5',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="flex items-start gap-2 text-foreground">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e): void => onChange(e.target.checked)}
          className="mt-0.5 rounded border-border"
        />
        <span className="leading-snug">{label}</span>
      </span>
      {hint ? <span className="pl-6 text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

interface ButtonProps {
  isMicrosoft: boolean
  values: ComposeMessageOptionsValues
  onApply: (values: ComposeMessageOptionsValues) => void
  compact?: boolean
  className?: string
}

/** Toolbar-Button öffnet den Dialog „Nachrichtenoptionen“. */
export function ComposeMessageOptionsButton({
  isMicrosoft,
  values,
  onApply,
  compact,
  className
}: ButtonProps): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const hasActiveOptions =
    values.importance !== 'normal' ||
    values.isReadReceiptRequested ||
    values.isDeliveryReceiptRequested ||
    values.smimeEncrypt ||
    values.smimeSign ||
    Boolean(values.scheduledSendAt?.trim())

  return (
    <>
      <button
        type="button"
        onClick={(e): void => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          compact
            ? 'rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground'
            : 'rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground',
          hasActiveOptions && 'text-primary',
          className
        )}
        aria-label={t('mail.compose.messageOptionsTitle', { defaultValue: 'Nachrichtenoptionen' })}
        title={t('mail.compose.messageOptionsTitle', { defaultValue: 'Nachrichtenoptionen' })}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
      <ComposeMessageOptionsDialog
        open={open}
        isMicrosoft={isMicrosoft}
        initial={values}
        onClose={(): void => setOpen(false)}
        onApply={(v): void => {
          onApply(v)
          setOpen(false)
        }}
      />
    </>
  )
}
