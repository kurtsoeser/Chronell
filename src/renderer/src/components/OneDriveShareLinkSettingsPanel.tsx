import { useState } from 'react'
import { Calendar, ChevronLeft, Eye, Globe, Link2, Loader2, Pencil, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ComposeDriveSharingLinkScope,
  ComposeDriveSharingLinkType
} from '@shared/types'
import { cn } from '@/lib/utils'

export type DriveShareLinkAccessMode = 'organization' | 'anonymous' | 'existing'

export interface DriveShareLinkPickSource {
  id: string
  name: string
  driveId?: string | null
  webUrl: string
}

interface Props {
  accountId: string
  file: DriveShareLinkPickSource
  onBack: () => void
  onCancel: () => void
  onApply: (result: { name: string; webUrl: string }) => void
}

export function OneDriveShareLinkSettingsPanel({
  accountId,
  file,
  onBack,
  onCancel,
  onApply
}: Props): JSX.Element {
  const { t } = useTranslation()
  const [accessMode, setAccessMode] = useState<DriveShareLinkAccessMode>('organization')
  const [linkType, setLinkType] = useState<ComposeDriveSharingLinkType>('view')
  const [expiration, setExpiration] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      if (accessMode === 'existing') {
        onApply({ name: file.name, webUrl: file.webUrl })
        return
      }

      const scope: ComposeDriveSharingLinkScope =
        accessMode === 'anonymous' ? 'anonymous' : 'organization'

      const fn = window.mailClient.compose.createDriveSharingLink
      if (typeof fn !== 'function') {
        throw new Error(
          t('mail.composeTile.cloudShareApiMissing', {
            defaultValue: 'Freigabe-API nicht verfügbar — App neu starten.'
          })
        )
      }

      const linkArgs: Parameters<typeof fn>[0] = {
        accountId,
        itemId: file.id,
        driveId: file.driveId ?? null,
        type: linkType,
        scope
      }
      const expRaw = expiration.trim()
      if (expRaw) {
        const d = new Date(expRaw)
        if (Number.isNaN(d.getTime())) {
          throw new Error(
            t('mail.composeTile.cloudShareInvalidDate', {
              defaultValue: 'Ungültiges Ablaufdatum.'
            })
          )
        }
        linkArgs.expirationDateTime = d.toISOString()
      }

      const { webUrl } = await fn(linkArgs)
      onApply({ name: file.name, webUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const accessOptions: Array<{
    id: DriveShareLinkAccessMode
    label: string
    hint: string
    icon: typeof Globe
  }> = [
    {
      id: 'anonymous',
      label: t('mail.composeTile.cloudShareAnyone', { defaultValue: 'Jeder' }),
      hint: t('mail.composeTile.cloudShareAnyoneHint', {
        defaultValue: 'Jeder mit dem Link (wenn von der Organisation erlaubt).'
      }),
      icon: Globe
    },
    {
      id: 'organization',
      label: t('mail.composeTile.cloudShareOrganization', {
        defaultValue: 'Personen in meiner Organisation'
      }),
      hint: t('mail.composeTile.cloudShareOrganizationHint', {
        defaultValue: 'Nur Nutzer in Ihrer Microsoft-365-Organisation.'
      }),
      icon: Users
    },
    {
      id: 'existing',
      label: t('mail.composeTile.cloudShareExisting', {
        defaultValue: 'Nur Personen mit vorhandenem Zugriff'
      }),
      hint: t('mail.composeTile.cloudShareExistingHint', {
        defaultValue: 'Bestehende Datei-URL, kein neuer Freigabe-Link.'
      }),
      icon: Link2
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('common.back', { defaultValue: 'Zurück' })}
          onClick={onBack}
          disabled={busy}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {t('mail.composeTile.cloudShareTitle', { defaultValue: 'Linkeinstellungen' })}
          </div>
          <div className="truncate text-[11px] text-muted-foreground" title={file.name}>
            {file.name}
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onCancel}
          disabled={busy}
        >
          {t('common.cancel', { defaultValue: 'Abbrechen' })}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {t('mail.composeTile.cloudShareWorksFor', {
              defaultValue: 'Der Link funktioniert für'
            })}
          </h3>
          <ul className="space-y-1">
            {accessOptions.map((opt) => {
              const Icon = opt.icon
              const active = accessMode === opt.id
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(): void => setAccessMode(opt.id)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/60 hover:bg-secondary/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2',
                        active ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                      )}
                    />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {accessMode !== 'existing' && (
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              {t('mail.composeTile.cloudShareMoreSettings', { defaultValue: 'Weitere Einstellungen' })}
            </h3>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={linkType}
                disabled={busy}
                onChange={(e): void =>
                  setLinkType(e.target.value === 'edit' ? 'edit' : 'view')
                }
              >
                <option value="view">
                  {t('mail.composeTile.cloudShareCanView', { defaultValue: 'Kann anzeigen' })}
                </option>
                <option value="edit">
                  {t('mail.composeTile.cloudShareCanEdit', { defaultValue: 'Kann bearbeiten' })}
                </option>
              </select>
            </label>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {t('mail.composeTile.cloudShareExpirationOptional', {
                    defaultValue: 'Ablaufdatum (optional)'
                  })}
                </span>
                {expiration ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={(): void => setExpiration('')}
                    disabled={busy}
                  >
                    {t('common.clear', { defaultValue: 'Leeren' })}
                  </button>
                ) : null}
              </div>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={expiration}
                disabled={busy}
                onChange={(e): void => setExpiration(e.target.value)}
                aria-label={t('mail.composeTile.cloudShareExpiration', {
                  defaultValue: 'Ablaufdatum'
                })}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('mail.composeTile.cloudShareExpirationHint', {
                  defaultValue: 'Leer lassen = Link ohne Ablauf (unbegrenzt gültig, sofern die Organisation das erlaubt).'
                })}
              </p>
            </div>
          </section>
        )}

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={(): void => void handleApply()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          {t('mail.composeTile.cloudShareApply', { defaultValue: 'Übernehmen' })}
        </button>
      </div>
    </div>
  )
}
