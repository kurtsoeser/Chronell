import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Columns3, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import {
  DEFAULT_MAIL_LIST_TABLE_COLUMNS,
  MAIL_LIST_TABLE_COLUMN_CATALOG,
  type MailListTableColumnId,
  moveMailListTableColumn,
  persistMailListTableColumns,
  toggleMailListTableColumn
} from '@/lib/mail-list-table-columns'

interface Props {
  open: boolean
  columns: MailListTableColumnId[]
  onClose: () => void
  onApply: (columns: MailListTableColumnId[]) => void
}

export function MailListTableColumnsDialog({
  open,
  columns,
  onClose,
  onApply
}: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<MailListTableColumnId[]>(columns)

  useEffect(() => {
    if (open) setDraft(columns)
  }, [open, columns])

  if (!open) return null

  function label(id: MailListTableColumnId): string {
    return t(`mail.listTableColumns.${id}` as const)
  }

  return (
    <ModalRoot open onBackdropClick={onClose}>
      <ModalPanel
        className="flex w-full max-w-md flex-col gap-3 p-4"
        aria-labelledby="mail-list-columns-title"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Columns3 className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 id="mail-list-columns-title" className="text-sm font-semibold text-foreground">
              {t('mail.listTableColumns.dialogTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{t('mail.listTableColumns.dialogHint')}</p>

        <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-md border border-border">
          {MAIL_LIST_TABLE_COLUMN_CATALOG.map((id) => {
            const enabled = draft.includes(id)
            const orderIdx = enabled ? draft.indexOf(id) : -1
            return (
              <div
                key={id}
                className={cn(
                  'flex items-center gap-2 border-b border-border/60 px-2 py-1.5 last:border-b-0',
                  enabled && 'bg-secondary/25'
                )}
              >
                <input
                  type="checkbox"
                  id={`mail-col-${id}`}
                  checked={enabled}
                  onChange={(e): void => {
                    setDraft((prev) => toggleMailListTableColumn(prev, id, e.target.checked))
                  }}
                  className="h-3.5 w-3.5 shrink-0 rounded border-border"
                />
                <label
                  htmlFor={`mail-col-${id}`}
                  className="min-w-0 flex-1 cursor-pointer text-xs text-foreground"
                >
                  {label(id)}
                </label>
                {enabled && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={orderIdx <= 0}
                      title={t('mail.listTableColumns.moveUp')}
                      onClick={(): void => setDraft((prev) => moveMailListTableColumn(prev, id, 'up'))}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={orderIdx < 0 || orderIdx >= draft.length - 1}
                      title={t('mail.listTableColumns.moveDown')}
                      onClick={(): void => setDraft((prev) => moveMailListTableColumn(prev, id, 'down'))}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={(): void => setDraft([...DEFAULT_MAIL_LIST_TABLE_COLUMNS])}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            <RotateCcw className="h-3 w-3" />
            {t('mail.listTableColumns.reset')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                persistMailListTableColumns(draft)
                onApply(draft)
                onClose()
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('mail.listTableColumns.apply')}
            </button>
          </div>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
