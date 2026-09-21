import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ConnectedAccount, MailMasterCategory } from '@shared/types'
import {
  OUTLOOK_COLOR_PRESET_OPTIONS,
  outlookCategoryDotClass
} from '@/lib/outlook-category-colors'
import { Check, Loader2, Pencil, Plus, Trash2, X, Star, StarOff } from 'lucide-react'
import {
  readFavoriteCategories,
  persistFavoriteCategories,
  toggleFavoriteCategory,
  type FavoriteCategoryRef
} from '@/lib/mail-category-favorites-storage'
import { showAppConfirm, useAppDialogStore } from '@/stores/app-dialog'

interface MailCategoriesPopoverProps {
  open: boolean
  anchor: { x: number; y: number }
  messageId: number
  account: ConnectedAccount | null
  selectedNames: string[]
  onClose: () => void
}

export function MailCategoriesPopover({
  open,
  anchor,
  messageId,
  account,
  selectedNames,
  onClose
}: MailCategoriesPopoverProps): JSX.Element | null {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [masters, setMasters] = useState<MailMasterCategory[]>([])
  const [distinct, setDistinct] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [draft, setDraft] = useState<string[]>([])
  const [favorites, setFavorites] = useState<FavoriteCategoryRef[]>(() => readFavoriteCategories())
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('preset4')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('preset4')

  const isMicrosoft = account?.provider === 'microsoft'

  const colorByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of masters) {
      m.set(c.displayName, c.color)
    }
    return m
  }, [masters])

  const masterByName = useMemo(() => {
    const m = new Map<string, MailMasterCategory>()
    for (const c of masters) {
      m.set(c.displayName, c)
    }
    return m
  }, [masters])

  useEffect(() => {
    if (open) {
      setDraft([...selectedNames])
      setNewCatName('')
      setNewCatColor('preset4')
      setEditingId(null)
      setFreeText('')
    }
  }, [open, selectedNames])

  useEffect(() => {
    if (open) setFavorites(readFavoriteCategories())
  }, [open])

  async function reloadMasters(): Promise<void> {
    if (!account) return
    const res = await window.mailClient.mail.listMasterCategories(account.id)
    setMasters(res)
    setDistinct([])
  }

  useEffect(() => {
    if (!open || !account) return
    setLoadErr(null)
    setBusy(true)
    const p = isMicrosoft
      ? window.mailClient.mail.listMasterCategories(account.id)
      : window.mailClient.mail.listDistinctMessageTags(account.id)
    void p
      .then((res) => {
        if (isMicrosoft) {
          setMasters(res as MailMasterCategory[])
          setDistinct([])
        } else {
          setMasters([])
          setDistinct(res as string[])
        }
      })
      .catch((e: unknown) => {
        setLoadErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setBusy(false))
  }, [open, account, isMicrosoft])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent): void {
      if (useAppDialogStore.getState().open) return
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, onClose])

  const choiceNames = useMemo(() => {
    if (isMicrosoft) {
      const fromMasters = masters.map((m) => m.displayName)
      const extra = draft.filter((n) => !fromMasters.includes(n))
      return [...new Set([...fromMasters, ...extra])].sort((a, b) => a.localeCompare(b, 'de'))
    }
    return [...new Set([...distinct, ...draft])].sort((a, b) => a.localeCompare(b, 'de'))
  }, [isMicrosoft, masters, distinct, draft])

  if (!open || !account) return null

  function isFav(name: string): boolean {
    const key = `${account!.id}::${name.toLowerCase()}`
    return favorites.some((f) => `${f.accountId ?? '*'}::${f.name.toLowerCase()}` === key)
  }

  function toggleFav(name: string): void {
    const next = toggleFavoriteCategory(favorites, { accountId: account!.id, name })
    setFavorites(next)
    persistFavoriteCategories(next)
  }

  async function applyCategories(next: string[]): Promise<void> {
    setBusy(true)
    setLoadErr(null)
    try {
      await window.mailClient.mail.setMessageCategories({ messageId, categories: next })
      onClose()
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function toggleDraftName(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    setDraft((d) => {
      const s = new Set(d)
      if (s.has(trimmed)) s.delete(trimmed)
      else s.add(trimmed)
      return Array.from(s).sort((a, b) => a.localeCompare(b, 'de'))
    })
  }

  function addFreeToDraft(): void {
    const t = freeText.trim()
    if (!t) return
    setDraft((d) => Array.from(new Set([...d, t])).sort((a, b) => a.localeCompare(b, 'de')))
    setFreeText('')
  }

  async function handleCreateMasterCategory(): Promise<void> {
    const name = newCatName.trim()
    if (!name || !account) return
    setBusy(true)
    setLoadErr(null)
    try {
      const created = await window.mailClient.mail.createMasterCategory({
        accountId: account.id,
        displayName: name,
        color: newCatColor
      })
      setNewCatName('')
      setNewCatColor('preset4')
      await reloadMasters()
      setDraft((d) =>
        Array.from(new Set([...d, created.displayName])).sort((a, b) => a.localeCompare(b, 'de'))
      )
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveMasterCategoryEdit(): Promise<void> {
    const name = editName.trim()
    if (!account || !editingId || !name) return
    const previous = masters.find((c) => c.id === editingId)
    const previousName = previous?.displayName
    setBusy(true)
    setLoadErr(null)
    try {
      await window.mailClient.mail.updateMasterCategory({
        accountId: account.id,
        categoryId: editingId,
        displayName: name,
        color: editColor
      })
      setEditingId(null)
      await reloadMasters()
      if (previousName && previousName !== name) {
        setDraft((d) => {
          if (!d.includes(previousName)) return d
          return Array.from(new Set(d.map((n) => (n === previousName ? name : n)))).sort((a, b) =>
            a.localeCompare(b, 'de')
          )
        })
        if (isFav(previousName)) {
          const withoutOld = toggleFavoriteCategory(favorites, {
            accountId: account.id,
            name: previousName
          })
          const withNew = toggleFavoriteCategory(withoutOld, { accountId: account.id, name })
          setFavorites(withNew)
          persistFavoriteCategories(withNew)
        }
      }
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMasterCategory(categoryId: string, displayName: string): Promise<void> {
    if (!account) return
    const ok = await showAppConfirm(t('settings.catDeleteConfirm'), {
      title: t('settings.catDeleteTitle'),
      variant: 'danger',
      confirmLabel: t('common.remove')
    })
    if (!ok) return
    setBusy(true)
    setLoadErr(null)
    try {
      await window.mailClient.mail.deleteMasterCategory({
        accountId: account.id,
        categoryId
      })
      if (editingId === categoryId) setEditingId(null)
      await reloadMasters()
      setDraft((d) => d.filter((n) => n !== displayName))
      if (isFav(displayName)) {
        const next = toggleFavoriteCategory(favorites, {
          accountId: account.id,
          name: displayName
        })
        setFavorites(next)
        persistFavoriteCategories(next)
      }
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'chronell-acrylic-popover fixed z-[200] w-[min(24rem,calc(100vw-1.5rem))] p-3 text-xs',
        'text-popover-foreground'
      )}
      style={{ left: anchor.x, top: anchor.y }}
      role="dialog"
      aria-label={t('mail.readingPane.categories')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{t('mail.readingPane.categories')}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isMicrosoft && (
        <p className="mb-2 leading-relaxed text-[10px] text-muted-foreground">
          {t('mail.readingPane.categoriesMasterManageHint')}
        </p>
      )}

      {!isMicrosoft && (
        <p className="mb-2 leading-relaxed text-[10px] text-muted-foreground">
          {t('mail.readingPane.categoriesLocalHint')}
        </p>
      )}

      {loadErr && (
        <div className="mb-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
          {loadErr}
        </div>
      )}

      {busy && choiceNames.length === 0 && !loadErr ? (
        <div className="flex items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('mail.readingPane.categoriesLoading')}
        </div>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
          {choiceNames.map((name) => {
            const on = draft.includes(name)
            const fav = isFav(name)
            const master = masterByName.get(name)
            const editing = master != null && editingId === master.id
            const dot = outlookCategoryDotClass(
              editing ? editColor : (master?.color ?? colorByName.get(name))
            )
            return (
              <li key={name}>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-secondary/40 px-1.5 py-1.5">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} aria-hidden />
                    <input
                      value={editName}
                      onChange={(e): void => setEditName(e.target.value)}
                      disabled={busy}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('settings.catNamePlaceholder')}
                    />
                    <select
                      value={editColor}
                      onChange={(e): void => setEditColor(e.target.value)}
                      disabled={busy}
                      className="max-w-[7rem] rounded border border-border bg-background px-1 py-0.5 text-[10px] outline-none"
                      aria-label={t('mail.readingPane.categoriesColor')}
                    >
                      {OUTLOOK_COLOR_PRESET_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !editName.trim()}
                      onClick={(): void => void handleSaveMasterCategoryEdit()}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => setEditingId(null)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex w-full items-center gap-0.5 rounded-md px-1 py-1 text-left transition-colors',
                      on ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary/80'
                    )}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => toggleDraftName(name)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
                      aria-pressed={on}
                    >
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                    </button>
                    {master && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(): void => {
                            setEditingId(master.id)
                            setEditName(master.displayName)
                            setEditColor(master.color || 'preset4')
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={t('common.edit')}
                          title={t('common.edit')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(): void =>
                            void handleDeleteMasterCategory(master.id, master.displayName)
                          }
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => toggleFav(name)}
                      className={cn(
                        'shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground',
                        fav && 'text-status-flagged'
                      )}
                      aria-label={
                        fav
                          ? t('mail.readingPane.categoriesFavRemove')
                          : t('mail.readingPane.categoriesFavAdd')
                      }
                      title={
                        fav
                          ? t('mail.readingPane.categoriesFavRemove')
                          : t('mail.readingPane.categoriesFavAdd')
                      }
                    >
                      {fav ? (
                        <Star className="h-3.5 w-3.5 fill-status-flagged text-status-flagged" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isMicrosoft && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <span className="text-[10px] text-muted-foreground">{t('settings.newCategory')}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={newCatName}
              onChange={(e): void => setNewCatName(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreateMasterCategory()
                }
              }}
              placeholder={t('settings.catNamePlaceholder')}
              disabled={busy}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              value={newCatColor}
              onChange={(e): void => setNewCatColor(e.target.value)}
              disabled={busy}
              className="max-w-[7rem] rounded-md border border-border bg-background px-1 py-1 text-[10px] outline-none"
              aria-label={t('mail.readingPane.categoriesColor')}
            >
              {OUTLOOK_COLOR_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !newCatName.trim()}
              onClick={(): void => void handleCreateMasterCategory()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {t('common.create')}
            </button>
          </div>
        </div>
      )}

      {!isMicrosoft && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <input
            value={freeText}
            onChange={(e): void => setFreeText(e.target.value)}
            onKeyDown={(e): void => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFreeToDraft()
              }
            }}
            placeholder={t('mail.readingPane.categoriesNewPlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            disabled={busy || !freeText.trim()}
            onClick={addFreeToDraft}
            className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            {t('common.ok')}
          </button>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(): void => void applyCategories(draft)}
          className="rounded-md bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('mail.readingPane.categoriesApply')}
        </button>
      </div>

      {isMicrosoft && masters.length === 0 && !busy && !loadErr && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {t('mail.readingPane.categoriesEmptyMasters')}
        </p>
      )}
    </div>
  )
}
