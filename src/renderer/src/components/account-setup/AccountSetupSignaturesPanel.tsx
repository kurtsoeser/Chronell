import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PenLine, Plus, Star, Trash2 } from 'lucide-react'
import type { AccountSignatureTemplate } from '@shared/types'
import { useAccountsStore } from '@/stores/accounts'
import { showAppConfirm, showAppPrompt } from '@/stores/app-dialog'
import { TipTapBody } from '@/components/TipTapBody'
import {
  newSignatureTemplateId,
  removeSignatureTemplate,
  sortSignatureTemplates,
  upsertSignatureTemplate
} from '@/lib/signature-templates'
import { cn } from '@/lib/utils'

/** Einstellungen → E-Mail → Signatur & Footer. */
export default function AccountSetupSignaturesPanel(): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const patchAccountSignatures = useAccountsStore((s) => s.patchAccountSignatures)

  const mailAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const [accountId, setAccountId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mailAccounts.length === 0) {
      setAccountId('')
      return
    }
    if (!mailAccounts.some((a) => a.id === accountId)) {
      setAccountId(mailAccounts[0].id)
    }
  }, [mailAccounts, accountId])

  const account = mailAccounts.find((a) => a.id === accountId)
  const templates = account?.signatureTemplates ?? []
  const defaultId = account?.defaultSignatureTemplateId ?? null
  const sorted = useMemo(() => sortSignatureTemplates(templates), [templates])

  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined

  useEffect(() => {
    if (!selected) {
      setDraftName('')
      setDraftHtml('')
      return
    }
    setDraftName(selected.name)
    setDraftHtml(selected.html)
  }, [selected?.id, selected?.name, selected?.html])

  const loadTemplate = (tpl: AccountSignatureTemplate): void => {
    setSelectedId(tpl.id)
    setDraftName(tpl.name)
    setDraftHtml(tpl.html)
  }

  const startNew = (): void => {
    setSelectedId(null)
    setDraftName('')
    setDraftHtml('')
  }

  const persist = async (
    nextTemplates: AccountSignatureTemplate[],
    defaultPatch?: string | null
  ): Promise<void> => {
    if (!accountId) return
    setSaving(true)
    try {
      await patchAccountSignatures(accountId, {
        signatureTemplates: nextTemplates,
        ...(defaultPatch !== undefined ? { defaultSignatureTemplateId: defaultPatch } : {})
      })
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = (): void => {
    void (async (): Promise<void> => {
      const name = draftName.trim()
      if (!name) {
        const prompted = await showAppPrompt(t('settings.signaturesNamePrompt'), {
          title: t('settings.signaturesNewTitle'),
          defaultValue: t('settings.signaturesDefaultName')
        })
        if (prompted === null) return
        const trimmed = prompted.trim()
        if (!trimmed) return
        setDraftName(trimmed)
        return saveDraftWithName(trimmed)
      }
      await saveDraftWithName(name)
    })()
  }

  const saveDraftWithName = async (name: string): Promise<void> => {
    const id = selectedId ?? newSignatureTemplateId()
    const next = upsertSignatureTemplate(templates, { id, name, html: draftHtml })
    await persist(next)
    setSelectedId(id)
  }

  const deleteSelected = (): void => {
    if (!selectedId || !selected) return
    void (async (): Promise<void> => {
      const ok = await showAppConfirm(
        t('settings.signaturesDeleteConfirm', { name: selected.name }),
        {
          title: t('settings.signaturesDeleteTitle'),
          variant: 'danger',
          confirmLabel: t('settings.signaturesDeleteButton')
        }
      )
      if (!ok) return
      const next = removeSignatureTemplate(templates, selectedId)
      const newDefault = defaultId === selectedId ? null : defaultId
      await persist(next, newDefault)
      setSelectedId(null)
      setDraftName('')
      setDraftHtml('')
    })()
  }

  const setAsDefault = (templateId: string | null): void => {
    void persist(templates, templateId)
  }

  if (mailAccounts.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
        {t('settings.signaturesNeedAccount')}
      </p>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <PenLine className="h-3.5 w-3.5" />
          {t('settings.signaturesHeading')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('settings.signaturesIntro')}</p>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('settings.signaturesAccountLabel')}
        </span>
        <select
          value={accountId}
          onChange={(e): void => {
            setAccountId(e.target.value)
            setSelectedId(null)
            setDraftName('')
            setDraftHtml('')
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
        >
          {mailAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="shrink-0 space-y-2 lg:w-52">
          <button
            type="button"
            onClick={startNew}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-secondary/60"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('settings.signaturesNewButton')}
          </button>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-border/35 bg-background/40 p-1">
            {sorted.length === 0 ? (
              <li className="px-2 py-2 text-[11px] text-muted-foreground">{t('settings.signaturesEmpty')}</li>
            ) : (
              sorted.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={(): void => loadTemplate(tpl)}
                    className={cn(
                      'flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-[11px] hover:bg-secondary/60',
                      tpl.id === selectedId && 'bg-primary/10 font-medium text-primary'
                    )}
                  >
                    {defaultId === tpl.id && (
                      <Star className="h-3 w-3 shrink-0 fill-primary text-primary" aria-hidden />
                    )}
                    <span className="min-w-0 truncate">{tpl.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="min-w-0 flex-1 space-y-2 rounded-md border border-border bg-background/40 p-3">
          <input
            type="text"
            value={draftName}
            onChange={(e): void => setDraftName(e.target.value)}
            placeholder={t('settings.signaturesNamePlaceholder')}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
          />
          <TipTapBody
            variant="compact"
            valueHtml={draftHtml}
            onChangeHtml={setDraftHtml}
            placeholder={t('settings.signaturesEditorPlaceholder')}
            editorMinHeightClass="min-h-[180px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveDraft}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t('settings.savingDots') : t('settings.signaturesSaveButton')}
            </button>
            {selectedId && selected && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={(): void =>
                    setAsDefault(defaultId === selectedId ? null : selectedId)
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary/60 disabled:opacity-50"
                >
                  <Star
                    className={cn(
                      'h-3.5 w-3.5',
                      defaultId === selectedId && 'fill-primary text-primary'
                    )}
                  />
                  {defaultId === selectedId
                    ? t('settings.signaturesUnsetDefault')
                    : t('settings.signaturesSetDefault')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={deleteSelected}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('settings.signaturesDeleteButton')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
