import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  advancedSearchDraftHasFilter,
  emptyAdvancedSearchDraft,
  mailSearchFolderScopeLabelKey,
  draftToAdvancedCriteria,
  type AdvancedSearchDraft,
} from '@shared/mail-advanced-search'
import type { MailSearchFolderScope } from '@shared/mail-search-scope'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { cn } from '@/lib/utils'

export type { AdvancedSearchDraft }
export { emptyAdvancedSearchDraft, draftToAdvancedCriteria, advancedSearchDraftHasFilter }

const FOLDER_SCOPES: MailSearchFolderScope[] = ['all', 'inbox', 'sent', 'archive', 'current']

function FieldRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 border-b border-border/70 px-1 py-2.5 last:border-b-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

const inputClass =
  'w-full border-0 bg-transparent px-0 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70'

export function TopbarAdvancedSearchPanel({
  open,
  draft,
  onDraftChange,
  bodyIndexEnabled,
  onClose,
  onSearch,
  onClear
}: {
  open: boolean
  draft: AdvancedSearchDraft
  onDraftChange: (next: AdvancedSearchDraft) => void
  bodyIndexEnabled: boolean | null
  onClose: () => void
  onSearch: () => void
  onClear: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [extraOpen, setExtraOpen] = useState(false)

  function patch(partial: Partial<AdvancedSearchDraft>): void {
    onDraftChange({ ...draft, ...partial })
  }

  const canSearch = advancedSearchDraftHasFilter(draft)

  return (
    <ModalRoot open={open} onBackdropClick={onClose} zIndex={420}>
      <ModalPanel className="chronell-dialog-panel flex w-full max-w-lg flex-col overflow-hidden p-0">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="flex-1 text-sm font-semibold text-foreground">{t('topbar.advancedSearchTitle')}</h2>
        </header>

        {bodyIndexEnabled === false ? (
          <p className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-foreground">
            {t('topbar.searchBodyIndexOffHint')}
          </p>
        ) : (
          <p className="border-b border-border/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            {t('topbar.searchBodyIndexOnHint')}
          </p>
        )}

        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-3 py-1">
          <FieldRow label={t('topbar.advancedSearchIn')}>
            <select
              className={cn(inputClass, 'cursor-pointer')}
              value={draft.folderScope}
              onChange={(e): void =>
                patch({ folderScope: e.target.value as MailSearchFolderScope })
              }
            >
              {FOLDER_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {t(mailSearchFolderScopeLabelKey(scope))}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label={t('topbar.advancedFrom')}>
            <input
              className={inputClass}
              value={draft.fromContains}
              onChange={(e): void => patch({ fromContains: e.target.value })}
              autoFocus
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedTo')}>
            <input
              className={inputClass}
              value={draft.toContains}
              onChange={(e): void => patch({ toContains: e.target.value })}
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedCc')}>
            <input
              className={inputClass}
              value={draft.ccContains}
              onChange={(e): void => patch({ ccContains: e.target.value })}
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedSubject')}>
            <input
              className={inputClass}
              value={draft.subjectContains}
              onChange={(e): void => patch({ subjectContains: e.target.value })}
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedKeywords')}>
            <input
              className={inputClass}
              value={draft.keywords}
              onChange={(e): void => patch({ keywords: e.target.value })}
              placeholder={t('topbar.advancedKeywordsHint')}
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedCategory')}>
            <input
              className={inputClass}
              value={draft.categoryContains}
              onChange={(e): void => patch({ categoryContains: e.target.value })}
              placeholder={t('topbar.advancedCategoryHint')}
            />
          </FieldRow>
          <FieldRow label={t('topbar.advancedDate')}>
            <div className="flex flex-col gap-2">
              <select
                className={cn(inputClass, 'cursor-pointer')}
                value={draft.dateKind}
                onChange={(e): void =>
                  patch({ dateKind: e.target.value as AdvancedSearchDraft['dateKind'] })
                }
                aria-label={t('topbar.advancedDateKind')}
              >
                <option value="received">{t('topbar.advancedDateReceived')}</option>
                <option value="sent">{t('topbar.advancedDateSent')}</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className={cn(inputClass, 'min-w-0 flex-1')}
                  value={draft.dateFrom}
                  onChange={(e): void => patch({ dateFrom: e.target.value })}
                  aria-label={t('topbar.advancedDateFrom')}
                />
                <input
                  type="date"
                  className={cn(inputClass, 'min-w-0 flex-1')}
                  value={draft.dateTo}
                  onChange={(e): void => patch({ dateTo: e.target.value })}
                  aria-label={t('topbar.advancedDateTo')}
                />
              </div>
            </div>
          </FieldRow>
          <FieldRow label={t('topbar.advancedReadStatus')}>
            <select
              className={cn(inputClass, 'cursor-pointer')}
              value={draft.readStatus}
              onChange={(e): void =>
                patch({ readStatus: e.target.value as AdvancedSearchDraft['readStatus'] })
              }
            >
              <option value="all">{t('topbar.advancedReadAll')}</option>
              <option value="unread">{t('topbar.advancedReadUnread')}</option>
              <option value="read">{t('topbar.advancedReadRead')}</option>
            </select>
          </FieldRow>
          <FieldRow label={t('topbar.advancedAttachments')}>
            <label className="flex items-center justify-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.hasAttachmentsOnly}
                onChange={(e): void => patch({ hasAttachmentsOnly: e.target.checked })}
              />
            </label>
          </FieldRow>
          {extraOpen ? (
            <p className="px-1 py-2 text-[11px] text-muted-foreground">
              {t('topbar.advancedMoreFiltersHint')}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-3 py-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60"
            onClick={(): void => setExtraOpen((o) => !o)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('topbar.advancedAddFilter')}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={onSearch}
              disabled={!canSearch}
            >
              {t('topbar.advancedSearchSubmit')}
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60"
              onClick={onClear}
            >
              {t('topbar.advancedSearchClear')}
            </button>
          </div>
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
