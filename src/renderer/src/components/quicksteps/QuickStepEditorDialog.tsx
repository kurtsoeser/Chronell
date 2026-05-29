import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Plus, Zap, Loader2, X } from 'lucide-react'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { MailDestinationFolderDialog } from '@/components/MailDestinationFolderDialog'
import { useMailStore } from '@/stores/mail'
import { useAccountsStore } from '@/stores/accounts'
import { cn } from '@/lib/utils'
import {
  QUICK_STEP_ACTION_CATALOG,
  defaultQuickStepAction,
  validateQuickStepDraft,
  type QuickStepAction,
  type QuickStepActionCategory,
  type QuickStepActionType,
  type MailQuickStepDetail
} from '@shared/quicksteps'
import type { RuleSnoozePreset } from '@shared/mail-rules'
import type { TodoDueKindOpen } from '@shared/types'

const SNOOZE_PRESETS: RuleSnoozePreset[] = [
  'in-1-hour',
  'in-3-hours',
  'this-evening',
  'tomorrow-morning',
  'tomorrow-evening',
  'next-monday',
  'next-week'
]

const TODO_KINDS: TodoDueKindOpen[] = ['today', 'tomorrow', 'this_week', 'later']

const CATEGORY_ORDER: QuickStepActionCategory[] = ['filing', 'status', 'categories', 'snooze']

function cloneActions(actions: QuickStepAction[]): QuickStepAction[] {
  return JSON.parse(JSON.stringify(actions)) as QuickStepAction[]
}

export function QuickStepEditorDialog({
  open,
  initial,
  onClose,
  onSaved
}: {
  open: boolean
  initial: MailQuickStepDetail | null
  onClose: () => void
  onSaved: (detail: MailQuickStepDetail) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const foldersByAccount = useMailStore((s) => s.foldersByAccount)

  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [actions, setActions] = useState<QuickStepAction[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folderPickIndex, setFolderPickIndex] = useState<number | null>(null)
  const [addType, setAddType] = useState<QuickStepActionType | ''>('')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setEnabled(initial?.enabled ?? true)
    setActions(initial?.actions?.length ? cloneActions(initial.actions) : [])
    setError(null)
    setAddType('')
    setFolderPickIndex(null)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    for (const acc of accounts) {
      if (foldersByAccount[acc.id]?.length) continue
      void window.mailClient.mail.listFolders(acc.id).then((folders) => {
        useMailStore.setState((s) => ({
          foldersByAccount: { ...s.foldersByAccount, [acc.id]: folders }
        }))
      })
    }
  }, [open, accounts, foldersByAccount])

  const allFolders = useMemo(
    () => Object.values(foldersByAccount).flat(),
    [foldersByAccount]
  )

  const catalogByCategory = useMemo(() => {
    const map = new Map<QuickStepActionCategory, typeof QUICK_STEP_ACTION_CATALOG>()
    for (const cat of CATEGORY_ORDER) {
      map.set(
        cat,
        QUICK_STEP_ACTION_CATALOG.filter((e) => e.category === cat)
      )
    }
    return map
  }, [])

  const addAction = useCallback((type: QuickStepActionType): void => {
    setActions((prev) => [...prev, defaultQuickStepAction(type)])
    setAddType('')
  }, [])

  const removeAction = useCallback((index: number): void => {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const patchAction = useCallback((index: number, patch: Partial<QuickStepAction>): void => {
    setActions((prev) => {
      const next = cloneActions(prev)
      next[index] = { ...next[index], ...patch } as QuickStepAction
      return next
    })
  }, [])

  async function handleSave(): Promise<void> {
    const validation = validateQuickStepDraft(name, actions)
    if (!validation.ok) {
      setError(t(`settings.quickSteps.errors.${validation.error}`))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await window.mailClient.mail.saveQuickStep({
        id: initial?.id,
        name: name.trim(),
        enabled,
        actions
      })
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
      <ModalRoot open={open} zIndex={210} centerClassName="items-center justify-center" onBackdropClick={onClose}>
        <ModalPanel className="flex max-h-[min(640px,90vh)] w-[min(520px,94vw)] flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="flex-1 text-sm font-semibold">
              {initial
                ? t('settings.quickSteps.editorEditTitle')
                : t('settings.quickSteps.editorNewTitle')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-secondary"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('settings.quickSteps.editorHint')}
            </p>
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-muted-foreground">
              {t('settings.quickSteps.ms365Note')}
            </p>

            {error && (
              <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t('settings.quickSteps.nameLabel')}</span>
              <input
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                value={name}
                onChange={(e): void => setName(e.target.value)}
                placeholder={t('settings.quickSteps.namePlaceholder')}
              />
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e): void => setEnabled(e.target.checked)}
              />
              {t('settings.quickSteps.enabledLabel')}
            </label>

            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('settings.quickSteps.actionsHeading')}
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t('settings.quickSteps.actionsAndHint')}
              </p>

              {actions.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('settings.quickSteps.noActions')}</p>
              ) : (
                <ol className="space-y-2">
                  {actions.map((action, index) => (
                    <li
                      key={index}
                      className="rounded-md border border-border bg-background/60 p-2 text-xs"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t(`settings.quickSteps.actionTypes.${action.type}`)}
                        </span>
                        <button
                          type="button"
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          onClick={(): void => removeAction(index)}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {action.type === 'move_to_folder' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1 hover:bg-muted"
                            onClick={(): void => setFolderPickIndex(index)}
                          >
                            {action.folderId > 0
                              ? allFolders.find((f) => f.id === action.folderId)?.name ??
                                t('settings.quickSteps.folderSelected', { id: action.folderId })
                              : t('settings.quickSteps.pickFolder')}
                          </button>
                        </div>
                      )}

                      {action.type === 'add_todo' && (
                        <select
                          className="w-full rounded border border-border bg-background px-2 py-1"
                          value={action.dueKind}
                          onChange={(e): void =>
                            patchAction(index, {
                              dueKind: e.target.value as TodoDueKindOpen
                            })
                          }
                        >
                          {TODO_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {t(`mail.todoNav.${k}`)}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.type === 'add_tag' && (
                        <input
                          className="w-full rounded border border-border bg-background px-2 py-1"
                          value={action.tag}
                          placeholder={t('settings.quickSteps.tagPlaceholder')}
                          onChange={(e): void => patchAction(index, { tag: e.target.value })}
                        />
                      )}

                      {action.type === 'snooze' && (
                        <select
                          className="w-full rounded border border-border bg-background px-2 py-1"
                          value={action.preset}
                          onChange={(e): void =>
                            patchAction(index, { preset: e.target.value as RuleSnoozePreset })
                          }
                        >
                          {SNOOZE_PRESETS.map((p) => (
                            <option key={p} value={p}>
                              {t(`settings.quickSteps.snoozePresets.${p}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                  value={addType}
                  onChange={(e): void => setAddType(e.target.value as QuickStepActionType | '')}
                >
                  <option value="">{t('settings.quickSteps.selectAction')}</option>
                  {CATEGORY_ORDER.map((cat) => (
                    <optgroup key={cat} label={t(`settings.quickSteps.categories.${cat}`)}>
                      {(catalogByCategory.get(cat) ?? []).map((entry) => (
                        <option key={entry.type} value={entry.type}>
                          {t(`settings.quickSteps.actionTypes.${entry.type}`)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addType}
                  className={cn(
                    'inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted',
                    !addType && 'opacity-50'
                  )}
                  onClick={(): void => {
                    if (addType) addAction(addType)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('settings.quickSteps.addAction')}
                </button>
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              onClick={onClose}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={(): void => void handleSave()}
              disabled={busy}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('common.save')}
            </button>
          </div>
        </ModalPanel>
      </ModalRoot>

      <MailDestinationFolderDialog
        open={folderPickIndex != null}
        zIndex={220}
        folders={allFolders}
        onClose={(): void => setFolderPickIndex(null)}
        onPick={async (folderId): Promise<void> => {
          if (folderPickIndex == null) return
          patchAction(folderPickIndex, { folderId })
        }}
      />
    </>
  )
}
