import { useTranslation } from 'react-i18next'
import { FileJson, Loader2, X } from 'lucide-react'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { cn } from '@/lib/utils'
import type { SettingsBackupContentsSummary } from '@shared/settings-backup-summary'

export type SettingsBackupContentsDialogMode = 'preview' | 'import'

interface Props {
  open: boolean
  mode: SettingsBackupContentsDialogMode
  summary: SettingsBackupContentsSummary | null
  busy?: boolean
  onClose: () => void
  onExport?: () => void
  onImport?: () => void
}

function CountRow({ label, value }: { label: string; value: number }): JSX.Element | null {
  if (value <= 0) return null
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  )
}

export function SettingsBackupContentsDialog({
  open,
  mode,
  summary,
  busy = false,
  onClose,
  onExport,
  onImport
}: Props): JSX.Element | null {
  const { t } = useTranslation()

  if (!summary) return null

  const title =
    mode === 'import'
      ? t('settings.backupContents.importTitle')
      : t('settings.backupContents.previewTitle')

  const db = summary.database
  const sec = summary.secure

  return (
    <ModalRoot open={open} onBackdropClick={onClose} zIndex={400}>
      <ModalPanel
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {t('settings.backupContents.meta', {
                  version: summary.formatVersion,
                  app: summary.appVersion,
                  exportedAt: new Date(summary.exportedAt).toLocaleString()
                })}
              </p>
            </div>
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <section className="space-y-1.5">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('settings.backupContents.sectionUi')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.backupContents.localStorageKeys', { count: summary.localStorageKeyCount })}
            </p>
            {summary.localStorageGroups.length > 0 ? (
              <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                {summary.localStorageGroups.slice(0, 16).map((g) => (
                  <li key={g.label} className="flex justify-between gap-2 text-2xs">
                    <span className="truncate font-mono text-muted-foreground">{g.label}</span>
                    <span className="shrink-0 tabular-nums">{g.count}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-1.5">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('settings.backupContents.sectionConfig')}
            </h3>
            <ul className="space-y-0.5 font-mono text-2xs text-muted-foreground">
              {summary.configHighlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {summary.hasDatabaseExtras ? (
            <section className="space-y-1.5">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('settings.backupContents.sectionDatabase')}
              </h3>
              <div className="space-y-0.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                <CountRow label={t('settings.backupContents.mailRules')} value={db.mailRules} />
                <CountRow label={t('settings.backupContents.workflowBoards')} value={db.workflowBoards} />
                <CountRow label={t('settings.backupContents.quickSteps')} value={db.quickSteps} />
                <CountRow label={t('settings.backupContents.mailTemplates')} value={db.mailTemplates} />
                <CountRow label={t('settings.backupContents.metaFolders')} value={db.metaFolders} />
                <CountRow label={t('settings.backupContents.vipSenders')} value={db.vipSenders} />
                <CountRow
                  label={t('settings.backupContents.workflowMailFolders')}
                  value={db.workflowMailFolders}
                />
                <CountRow label={t('settings.backupContents.userNotes')} value={db.userNotes} />
                <CountRow label={t('settings.backupContents.noteSections')} value={db.noteSections} />
                <CountRow label={t('settings.backupContents.entityLinks')} value={db.entityLinks} />
                <CountRow label={t('settings.backupContents.fullEntityLinks')} value={db.fullEntityLinks} />
                <CountRow
                  label={t('settings.backupContents.calendarColorOverrides')}
                  value={db.calendarColorOverrides}
                />
                <CountRow
                  label={t('settings.backupContents.composeScheduled')}
                  value={db.composeScheduledPending}
                />
              </div>
            </section>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('settings.backupContents.noDatabaseExtras')}
            </p>
          )}

          {summary.hasSecureExtras ? (
            <section className="space-y-1.5">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('settings.backupContents.sectionSecure')}
              </h3>
              <div className="space-y-0.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                <CountRow
                  label={t('settings.backupContents.accountPreferences')}
                  value={sec.accountPreferences}
                />
                <CountRow
                  label={t('settings.backupContents.signatures')}
                  value={sec.accountsWithSignatures}
                />
                <CountRow
                  label={t('settings.backupContents.sharedMailboxes')}
                  value={sec.accountsWithSharedMailboxes}
                />
                <CountRow label={t('settings.backupContents.notionFavorites')} value={sec.notionFavorites} />
                {sec.aiConnectionsIncluded ? (
                  <p className="text-xs text-foreground">
                    {t('settings.backupContents.aiIncluded', {
                      dismissed: sec.aiDismissedPairs
                    })}
                  </p>
                ) : null}
              </div>
            </section>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('settings.backupContents.noSecureExtras')}
            </p>
          )}

          {summary.warnings.length > 0 ? (
            <section className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                {t('settings.backupContents.sectionWarnings')}
              </h3>
              <ul className="list-inside list-disc space-y-0.5 text-2xs leading-relaxed text-amber-900 dark:text-amber-100">
                {summary.warnings.map((w) => (
                  <li key={w}>{t(`settings.backupContents.warning.${w}`)}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {t('common.close')}
          </button>
          {mode === 'preview' && onExport ? (
            <button
              type="button"
              onClick={onExport}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                busy
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('settings.exportDots')}
            </button>
          ) : null}
          {mode === 'import' && onImport ? (
            <button
              type="button"
              onClick={onImport}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                busy
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('common.import')}
            </button>
          ) : null}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
