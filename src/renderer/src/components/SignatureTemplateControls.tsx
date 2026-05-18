import { useMemo, useState } from 'react'
import { BookmarkPlus, ChevronDown, Save, Settings2, Star, Trash2 } from 'lucide-react'
import type { AccountSignatureTemplate } from '@shared/types'
import { useAccountsStore } from '@/stores/accounts'
import { showAppAlert, showAppConfirm, showAppPrompt } from '@/stores/app-dialog'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import {
  newSignatureTemplateId,
  removeSignatureTemplate,
  sortSignatureTemplates,
  upsertSignatureTemplate
} from '@/lib/signature-templates'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import { cn } from '@/lib/utils'

interface Props {
  accountId: string
  signatureRichHtml: string
  onSignatureHtmlChange: (html: string) => void
  /** ID der geladenen Vorlage; `null` = frei bearbeitet. */
  activeTemplateId?: string | null
  onActiveTemplateIdChange?: (id: string | null) => void
  /** Schmalere Abstaende (Dashboard-Kachel). */
  compact?: boolean
}

export function SignatureTemplateControls({
  accountId,
  signatureRichHtml,
  onSignatureHtmlChange,
  activeTemplateId = null,
  onActiveTemplateIdChange,
  compact
}: Props): JSX.Element {
  const accounts = useAccountsStore((s) => s.accounts)
  const patchAccountSignatures = useAccountsStore((s) => s.patchAccountSignatures)
  const account = accounts.find((a) => a.id === accountId)
  const templates = account?.signatureTemplates ?? []
  const defaultId = account?.defaultSignatureTemplateId ?? null

  const [manageOpen, setManageOpen] = useState(false)
  const [applyKey, setApplyKey] = useState(0)

  const sorted = useMemo(() => sortSignatureTemplates(templates), [templates])

  const activeTemplate = activeTemplateId
    ? templates.find((t) => t.id === activeTemplateId)
    : undefined

  const setActiveId = (id: string | null): void => {
    onActiveTemplateIdChange?.(id)
  }

  const applyById = (id: string): void => {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    onSignatureHtmlChange(sanitizeComposeHtmlFragment(tpl.html))
    setActiveId(id)
    setApplyKey((k) => k + 1)
  }

  const persistTemplates = async (next: AccountSignatureTemplate[]): Promise<void> => {
    try {
      await patchAccountSignatures(accountId, { signatureTemplates: next })
    } catch (e) {
      console.warn('[signature] Speichern:', e)
      void showAppAlert(e instanceof Error ? e.message : String(e), { title: 'Signaturvorlage' })
    }
  }

  const saveCurrentAsNewTemplate = (): void => {
    void (async (): Promise<void> => {
      const raw = signatureRichHtml.trim()
      if (!raw) {
        void showAppAlert('Bitte zuerst eine Signatur im Editor eintragen.', {
          title: 'Signaturvorlage'
        })
        return
      }
      const name = await showAppPrompt('Name der neuen Signaturvorlage:', {
        title: 'Vorlage speichern',
        defaultValue: activeTemplate?.name ?? 'Meine Signatur',
        placeholder: 'z. B. Geschäftlich'
      })
      if (name === null) return
      const trimmed = name.trim()
      if (!trimmed) return
      const html = sanitizeComposeHtmlFragment(raw)
      const id = newSignatureTemplateId()
      const next = upsertSignatureTemplate(templates, { id, name: trimmed, html })
      await persistTemplates(next)
      setActiveId(id)
    })()
  }

  const updateActiveTemplate = (): void => {
    void (async (): Promise<void> => {
      if (!activeTemplateId || !activeTemplate) {
        saveCurrentAsNewTemplate()
        return
      }
      const raw = signatureRichHtml.trim()
      if (!raw) {
        void showAppAlert('Die Signatur ist leer — nichts zu speichern.', { title: 'Signaturvorlage' })
        return
      }
      const next = upsertSignatureTemplate(templates, {
        id: activeTemplateId,
        name: activeTemplate.name,
        html: raw
      })
      await persistTemplates(next)
    })()
  }

  const setDefaultForAccount = (templateId: string | null): void => {
    void (async (): Promise<void> => {
      try {
        await patchAccountSignatures(accountId, { defaultSignatureTemplateId: templateId })
      } catch (e) {
        console.warn('[signature] Standard setzen:', e)
      }
    })()
  }

  const removeTemplate = (tpl: AccountSignatureTemplate): void => {
    void (async (): Promise<void> => {
      const ok = await showAppConfirm(`Vorlage «${tpl.name}» wirklich löschen?`, {
        title: 'Signaturvorlage löschen',
        variant: 'danger',
        confirmLabel: 'Löschen'
      })
      if (!ok) return
      const next = removeSignatureTemplate(templates, tpl.id)
      const newDefault = defaultId === tpl.id ? null : defaultId
      try {
        await patchAccountSignatures(accountId, {
          signatureTemplates: next,
          defaultSignatureTemplateId: newDefault
        })
        if (activeTemplateId === tpl.id) {
          setActiveId(null)
        }
      } catch (e) {
        console.warn('[signature] Löschen:', e)
      }
    })()
  }

  const selClass = compact
    ? 'max-w-[min(200px,46vw)] rounded border border-border/60 bg-background px-1 py-0.5 text-[10px]'
    : 'max-w-[min(260px,52vw)] rounded border border-border/60 bg-background px-2 py-1 text-xs'

  const btnClass = compact
    ? 'inline-flex shrink-0 items-center gap-0.5 rounded border border-border/60 bg-background px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground'
    : 'inline-flex shrink-0 items-center gap-1 rounded border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground'

  const btnPrimaryClass = cn(
    btnClass,
    'border-primary/40 text-foreground hover:bg-primary/10'
  )

  return (
    <div className={cn('flex flex-col gap-1', compact ? '' : 'gap-1.5')}>
      {activeTemplate && (
        <p className={cn('text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
          Bearbeitest: <span className="font-medium text-foreground">{activeTemplate.name}</span>
        </p>
      )}
      <div className={cn('flex flex-wrap items-center gap-1', compact ? '' : 'gap-1.5')}>
        <select
          key={`apply-${applyKey}`}
          className={selClass}
          aria-label="Signaturvorlage einfügen"
          title="Vorlage in die Signatur übernehmen"
          defaultValue=""
          onChange={(e): void => {
            const v = e.target.value
            e.currentTarget.selectedIndex = 0
            if (!v) return
            if (v === '__empty__') {
              onSignatureHtmlChange('')
              setActiveId(null)
              return
            }
            applyById(v)
          }}
        >
          <option value="">Vorlage wählen…</option>
          <option value="__empty__">— Leer (keine Signatur)</option>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {activeTemplate ? (
          <button
            type="button"
            className={btnPrimaryClass}
            title="Änderungen in die gewählte Vorlage schreiben"
            onClick={updateActiveTemplate}
          >
            <Save className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {!compact && <span>Vorlage aktualisieren</span>}
          </button>
        ) : null}

        <button
          type="button"
          className={btnClass}
          title={
            activeTemplate
              ? 'Aktuelle Signatur als neue Vorlage speichern'
              : 'Aktuelle Signatur als Vorlage speichern'
          }
          onClick={saveCurrentAsNewTemplate}
        >
          <BookmarkPlus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {!compact && <span>{activeTemplate ? 'Als neu speichern' : 'Speichern'}</span>}
        </button>

        <div className="flex items-center gap-0.5">
          <Star className={cn('shrink-0 text-muted-foreground', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <select
            className={selClass}
            aria-label="Standard-Signatur für neues Schreiben"
            title="Für neue Mails automatisch einfügen"
            value={
              defaultId && templates.some((t) => t.id === defaultId) ? defaultId : ''
            }
            onChange={(e): void => {
              const v = e.target.value
              setDefaultForAccount(v === '' ? null : v)
            }}
          >
            <option value="">Standard: keine</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {templates.length > 0 && (
          <button
            type="button"
            className={btnClass}
            onClick={(): void => setManageOpen((o) => !o)}
            title="Vorlagen verwalten"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', manageOpen && 'rotate-180')} />
            {!compact && <span>Verwalten</span>}
          </button>
        )}

        <button
          type="button"
          className={btnClass}
          title="Signaturvorlagen in den Einstellungen bearbeiten"
          onClick={(): void => requestOpenAccountSettings({ tab: 'mail', mailSubNav: 'signatures' })}
        >
          <Settings2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {!compact && <span>Einstellungen</span>}
        </button>
      </div>

      {manageOpen && templates.length > 0 && (
        <ul
          className={cn(
            'max-h-32 overflow-y-auto rounded border border-border/50 bg-background/90 p-1 text-[10px]',
            compact ? 'text-[10px]' : 'text-xs'
          )}
        >
          {sorted.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-secondary/60"
            >
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1 truncate text-left',
                  t.id === activeTemplateId && 'font-medium text-primary'
                )}
                title="In den Editor laden"
                onClick={(): void => applyById(t.id)}
              >
                {t.name}
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                title="Vorlage löschen"
                aria-label={`Vorlage ${t.name} löschen`}
                onClick={(): void => removeTemplate(t)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
