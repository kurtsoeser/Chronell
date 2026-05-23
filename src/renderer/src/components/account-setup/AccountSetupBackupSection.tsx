import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  FolderOpen,
  Loader2,
  ListTree,
  RefreshCw,
  Upload
} from 'lucide-react'
import { AccountSetupLocalDataSection } from '@/components/AccountSetupLocalDataSection'
import { SettingsBackupContentsDialog } from '@/components/account-setup/SettingsBackupContentsDialog'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  replaceLocalStorageFromBackup,
  snapshotLocalStorage
} from '@/lib/local-storage-snapshot'
import { cn } from '@/lib/utils'
import type {
  LocalDataUsageReport,
  SettingsAutoBackupStatus,
  SettingsBackupPayload
} from '@shared/types'
import type { SettingsBackupContentsSummary } from '@shared/settings-backup-summary'

interface Props {
  busy: boolean
  localDataUsage: LocalDataUsageReport | null
  localDataScanning: boolean
  localDataBusy: boolean
  onOptimize: () => void
  onExportPortable: () => void
  onExportFull: () => void
  onImportArchive: () => void
  onError: (message: string | null) => void
  onNotice: (message: string | null) => void
}

export function AccountSetupBackupSection({
  busy,
  localDataUsage,
  localDataScanning,
  localDataBusy,
  onOptimize,
  onExportPortable,
  onExportFull,
  onImportArchive,
  onError,
  onNotice
}: Props): JSX.Element {
  const { t } = useTranslation()
  const [backupBusy, setBackupBusy] = useState(false)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [contentsMode, setContentsMode] = useState<'preview' | 'import'>('preview')
  const [contentsSummary, setContentsSummary] = useState<SettingsBackupContentsSummary | null>(null)
  const [pendingImport, setPendingImport] = useState<SettingsBackupPayload | null>(null)
  const [autoBackup, setAutoBackup] = useState<SettingsAutoBackupStatus | null>(null)
  const [autoBackupBusy, setAutoBackupBusy] = useState(false)

  const refreshAutoBackup = useCallback(async (): Promise<void> => {
    const status = await window.mailClient.settingsBackup.getAutoBackupStatus()
    setAutoBackup(status)
  }, [])

  useEffect(() => {
    void refreshAutoBackup()
  }, [refreshAutoBackup])

  async function handleShowPreview(): Promise<void> {
    onError(null)
    setBackupBusy(true)
    try {
      const ls = snapshotLocalStorage()
      const summary = await window.mailClient.settingsBackup.buildPreview(ls)
      setContentsMode('preview')
      setContentsSummary(summary)
      setPendingImport(null)
      setContentsOpen(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleExportSettingsBackup(): Promise<void> {
    onNotice(null)
    onError(null)
    setBackupBusy(true)
    try {
      const ls = snapshotLocalStorage()
      const r = await window.mailClient.settingsBackup.exportToFile(ls)
      if (!r.ok) return
      onNotice(t('settings.backupSavedPath', { path: r.path }))
      void refreshAutoBackup()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBackupBusy(false)
    }
  }

  async function applyPendingImport(): Promise<void> {
    if (!pendingImport) return
    setBackupBusy(true)
    try {
      await window.mailClient.settingsBackup.applyFull(pendingImport)
      replaceLocalStorageFromBackup(pendingImport.localStorage)
      window.location.reload()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBackupBusy(false)
      setContentsOpen(false)
      setPendingImport(null)
    }
  }

  async function handleImportSettingsBackup(): Promise<void> {
    onNotice(null)
    onError(null)
    setBackupBusy(true)
    try {
      const pick = await window.mailClient.settingsBackup.pickAndRead()
      if (!pick.ok) {
        if ('error' in pick) onError(pick.error)
        return
      }
      const summary = await window.mailClient.settingsBackup.summarize(pick.backup)
      setContentsMode('import')
      setContentsSummary(summary)
      setPendingImport(pick.backup)
      setContentsOpen(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleImportFromDialog(): Promise<void> {
    if (!pendingImport) return
    const ok = await showAppConfirm(t('settings.importConfirmBody'), {
      title: t('settings.importConfirmTitle'),
      variant: 'danger',
      confirmLabel: t('common.import')
    })
    if (!ok) return
    await applyPendingImport()
  }

  async function handleToggleAutoBackup(): Promise<void> {
    if (!autoBackup) return
    setAutoBackupBusy(true)
    try {
      const next = !autoBackup.enabled
      const status = await window.mailClient.settingsBackup.setAutoBackup({ enabled: next })
      setAutoBackup(status)
      if (next && !status.directory) {
        onNotice(t('settings.autoBackup.pickFolderHint'))
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setAutoBackupBusy(false)
    }
  }

  async function handlePickAutoBackupFolder(): Promise<void> {
    setAutoBackupBusy(true)
    try {
      const r = await window.mailClient.settingsBackup.pickAutoBackupDirectory()
      if (!r.ok) return
      const status = await window.mailClient.settingsBackup.setAutoBackup({
        enabled: true,
        directory: r.path
      })
      setAutoBackup(status)
      onNotice(t('settings.autoBackup.folderSet', { path: r.path }))
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setAutoBackupBusy(false)
    }
  }

  async function handleRunAutoBackupNow(): Promise<void> {
    setAutoBackupBusy(true)
    onError(null)
    try {
      const ls = snapshotLocalStorage()
      const r = await window.mailClient.settingsBackup.runAutoBackupNow(ls)
      await refreshAutoBackup()
      if (r.ok) {
        onNotice(t('settings.autoBackup.saved', { path: r.path }))
      } else {
        onError(r.error)
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setAutoBackupBusy(false)
    }
  }

  const sectionBusy = backupBusy || busy
  const autoDisabled = autoBackupBusy || sectionBusy

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('settings.backupHeading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.backupIntro')}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t('settings.backupAiConnectionsNote')}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(): void => void handleShowPreview()}
          disabled={sectionBusy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            sectionBusy
              ? 'bg-secondary text-muted-foreground'
              : 'border border-border bg-secondary/80 text-foreground hover:bg-secondary'
          )}
        >
          <ListTree className="h-3.5 w-3.5" />
          {t('settings.backupContents.showButton')}
        </button>
        <button
          type="button"
          onClick={(): void => void handleExportSettingsBackup()}
          disabled={sectionBusy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            sectionBusy
              ? 'bg-secondary text-muted-foreground'
              : 'border border-border bg-secondary/80 text-foreground hover:bg-secondary'
          )}
        >
          {backupBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {t('settings.exportDots')}
        </button>
        <button
          type="button"
          onClick={(): void => void handleImportSettingsBackup()}
          disabled={sectionBusy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            sectionBusy
              ? 'bg-secondary text-muted-foreground'
              : 'border border-border bg-secondary/80 text-foreground hover:bg-secondary'
          )}
        >
          {backupBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {t('settings.importDots')}
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-background/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-foreground">{t('settings.autoBackup.heading')}</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {t('settings.autoBackup.intro')}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoBackup?.enabled === true}
              disabled={autoDisabled || autoBackup == null}
              onChange={(): void => void handleToggleAutoBackup()}
              className="rounded border-border"
            />
            <span>{t('settings.autoBackup.enabledLabel')}</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(): void => void handlePickAutoBackupFolder()}
            disabled={autoDisabled}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary"
          >
            <FolderOpen className="h-3 w-3" />
            {t('settings.autoBackup.pickFolder')}
          </button>
          <button
            type="button"
            onClick={(): void => void handleRunAutoBackupNow()}
            disabled={autoDisabled || !autoBackup?.directory}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary"
          >
            {autoBackupBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {t('settings.autoBackup.runNow')}
          </button>
        </div>

        {autoBackup?.directory ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground" title={autoBackup.directory}>
            {t('settings.autoBackup.folderPath', { path: autoBackup.directory })}
          </p>
        ) : null}
        {autoBackup?.lastAt ? (
          <p className="text-[10px] text-muted-foreground">
            {t('settings.autoBackup.lastRun', {
              when: new Date(autoBackup.lastAt).toLocaleString()
            })}
          </p>
        ) : null}
        {autoBackup?.lastError ? (
          <p className="text-[10px] text-red-600 dark:text-red-400">{autoBackup.lastError}</p>
        ) : null}
      </div>

      <AccountSetupLocalDataSection
        localDataUsage={localDataUsage}
        localDataScanning={localDataScanning}
        localDataBusy={localDataBusy}
        backupBusy={backupBusy}
        busy={busy}
        onOptimize={onOptimize}
        onExportPortable={onExportPortable}
        onExportFull={onExportFull}
        onImportArchive={onImportArchive}
      />

      <SettingsBackupContentsDialog
        open={contentsOpen}
        mode={contentsMode}
        summary={contentsSummary}
        busy={backupBusy}
        onClose={(): void => {
          if (backupBusy) return
          setContentsOpen(false)
          setPendingImport(null)
        }}
        onExport={
          contentsMode === 'preview'
            ? (): void => {
                setContentsOpen(false)
                void handleExportSettingsBackup()
              }
            : undefined
        }
        onImport={contentsMode === 'import' ? (): void => void handleImportFromDialog() : undefined}
      />
    </section>
  )
}
