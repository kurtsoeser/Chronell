import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2, Notebook, RefreshCw, Search, X } from 'lucide-react'
import type { OneNoteCatalog, OneNotePickResult, OneNoteSection } from '@shared/types/onenote'
import {
  buildOneNotePickerRows,
  groupOneNotePickerRows,
  preferredSection,
  type OneNoteGroupMode,
  type OneNoteKindFilter,
  type OneNotePickerRow
} from '@shared/onenote-catalog'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { useOneNoteDestinationPickerStore } from '@/stores/onenote-destination-picker'

const KIND_OPTIONS: OneNoteKindFilter[] = ['alle', 'notebooks', 'sections']
const GROUP_MODES: OneNoteGroupMode[] = ['modified', 'opened', 'used', 'notebook']
const KIND_KEY = 'chronell.onenote.kind'
const GROUP_KEY = 'chronell.onenote.groupMode'

function readStoredKind(): OneNoteKindFilter {
  try {
    const raw = localStorage.getItem(KIND_KEY)
    if (raw === 'alle' || raw === 'notebooks' || raw === 'sections') return raw
  } catch {
    /* private mode */
  }
  return 'alle'
}

function readStoredGroup(): OneNoteGroupMode {
  try {
    const raw = localStorage.getItem(GROUP_KEY)
    if (raw === 'modified' || raw === 'opened' || raw === 'used' || raw === 'notebook') return raw
  } catch {
    /* private mode */
  }
  return 'modified'
}

function formatWhen(iso: string | null, locale: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale.startsWith('en') ? 'en-GB' : 'de-AT', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function sectionsOf(catalog: OneNoteCatalog, notebookId: string): OneNoteSection[] {
  return catalog.sections
    .filter((section) => section.notebookId === notebookId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
}

export function OneNoteDestinationPickerDialog(): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const open = useOneNoteDestinationPickerStore((s) => s.open)
  const messageId = useOneNoteDestinationPickerStore((s) => s.messageId)
  const subject = useOneNoteDestinationPickerStore((s) => s.subject)
  const close = useOneNoteDestinationPickerStore((s) => s.close)

  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<OneNoteCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<OneNoteKindFilter>(readStoredKind)
  const [groupMode, setGroupMode] = useState<OneNoteGroupMode>(readStoredGroup)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = useCallback(async (id: number): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.mailClient.onenote.listCatalog(id)
      setCatalog(next)
    } catch (err) {
      setCatalog(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || messageId == null) return
    setQuery('')
    setExpanded({})
    void load(messageId)
  }, [open, messageId, load])

  const rows = useMemo(() => {
    if (!catalog) return []
    return buildOneNotePickerRows({
      notebooks: catalog.notebooks,
      sections: catalog.sections,
      recent: catalog.recent,
      opened: catalog.opened,
      query,
      kind
    })
  }, [catalog, query, kind])

  const groups = useMemo(
    () => groupOneNotePickerRows(rows, groupMode),
    [rows, groupMode]
  )

  const lastUsed = catalog?.recent[0] ?? null
  const defaultNotebook = catalog?.notebooks.find((notebook) => notebook.isDefault) ?? null
  const defaultSection = defaultNotebook
    ? preferredSection(defaultNotebook.id, catalog?.sections ?? [], catalog?.recent ?? [])
    : null

  function pick(result: OneNotePickResult): void {
    close(result)
  }

  function toggleExpanded(notebookId: string): void {
    setExpanded((prev) => ({ ...prev, [notebookId]: !prev[notebookId] }))
  }

  function rowMeta(row: OneNotePickerRow): string {
    if (row.targetKind === 'section') {
      const place = [row.notebookName, row.sectionGroupName].filter(Boolean).join(' · ')
      const when = formatWhen(row.modifiedAt, i18n.language)
      return when ? `${place} · ${when}` : place
    }
    const count = catalog ? sectionsOf(catalog, row.notebookId).length : 0
    const place = row.sectionName
      ? t('oneNote.sectionLine', { name: row.sectionName })
      : t('oneNote.newSectionLine')
    const when = formatWhen(row.modifiedAt, i18n.language)
    return [t('oneNote.sectionCount', { count }), place, when].filter(Boolean).join(' · ')
  }

  if (!open) return null

  const showTree = kind !== 'sections'

  return (
    <ModalRoot open={open} onBackdropClick={(): void => close(null)}>
      <ModalPanel
        className={cn(
          'flex max-h-[min(85vh,680px)] w-full max-w-lg flex-col overflow-hidden',
          listSubtleBorderClass,
          'bg-background shadow-xl'
        )}
        aria-modal="true"
        aria-labelledby="onenote-picker-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="onenote-picker-title" className="text-sm font-semibold">
              {t('oneNote.pickerTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('oneNote.pickerHint')}</p>
            {subject ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{subject}</p>
            ) : null}
            {catalog?.accountEmail ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {t('oneNote.accountLine', { email: catalog.accountEmail })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
              onClick={(): void => {
                if (messageId != null) void load(messageId)
              }}
              aria-label={t('oneNote.refresh')}
              disabled={loading || messageId == null}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
              onClick={(): void => close(null)}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-2 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              {t('oneNote.kindLabel')}
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={kind}
                onChange={(e): void => {
                  const next = e.target.value as OneNoteKindFilter
                  setKind(next)
                  try {
                    localStorage.setItem(KIND_KEY, next)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`oneNote.kind.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              {t('oneNote.groupLabel')}
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={groupMode}
                onChange={(e): void => {
                  const next = e.target.value as OneNoteGroupMode
                  setGroupMode(next)
                  try {
                    localStorage.setItem(GROUP_KEY, next)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {GROUP_MODES.map((option) => (
                  <option key={option} value={option}>
                    {t(`oneNote.group.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm"
              value={query}
              onChange={(e): void => setQuery(e.target.value)}
              placeholder={t('oneNote.searchPlaceholder')}
              autoFocus
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {loading && !catalog ? (
            <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : null}

          {!query.trim() && lastUsed ? (
            <button
              type="button"
              className="mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left text-sm text-primary hover:bg-primary/10"
              onClick={(): void =>
                pick({
                  notebookId: lastUsed.notebookId,
                  sectionId: lastUsed.sectionId,
                  notebookName: lastUsed.notebookName,
                  sectionName: lastUsed.sectionName
                })
              }
            >
              <span className="font-medium">{t('oneNote.lastUsedAction')}</span>
              <span className="text-xs text-muted-foreground">
                {lastUsed.notebookName} · {lastUsed.sectionName}
              </span>
            </button>
          ) : null}

          {!query.trim() &&
          defaultNotebook &&
          !(
            lastUsed &&
            lastUsed.notebookId === defaultNotebook.id &&
            lastUsed.sectionId === (defaultSection?.id ?? null)
          ) ? (
            <button
              type="button"
              className="mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left text-sm text-primary hover:bg-primary/10"
              onClick={(): void =>
                pick({
                  notebookId: defaultNotebook.id,
                  sectionId: defaultSection?.id ?? null,
                  notebookName: defaultNotebook.displayName,
                  sectionName: defaultSection?.displayName ?? null
                })
              }
            >
              <span className="font-medium">{t('oneNote.defaultAction')}</span>
              <span className="text-xs text-muted-foreground">
                {defaultNotebook.displayName}
                {defaultSection ? ` · ${defaultSection.displayName}` : ''}
              </span>
            </button>
          ) : null}

          {groups.map((group) => (
            <section key={group.key} className="py-1">
              <p className="sticky top-0 z-[1] bg-background/95 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                {group.labelKey === 'notebook' ? group.label : t(`oneNote.bucket.${group.labelKey}`)}
                <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                  ({group.items.length})
                </span>
              </p>
              <ul>
                {group.items.map((row) => {
                  const childSections =
                    showTree && row.targetKind === 'notebook' && catalog
                      ? sectionsOf(catalog, row.notebookId).filter((section) => {
                          const q = query.trim().toLocaleLowerCase('de')
                          if (!q) return true
                          return (
                            section.displayName.toLocaleLowerCase('de').includes(q) ||
                            (section.sectionGroupName || '').toLocaleLowerCase('de').includes(q)
                          )
                        })
                      : []
                  const isOpen = expanded[row.notebookId] === true && row.targetKind === 'notebook'
                  return (
                    <li key={row.key}>
                      <div className="flex items-stretch gap-0.5">
                        {showTree && row.targetKind === 'notebook' ? (
                          <button
                            type="button"
                            className="mt-1 rounded p-1 text-muted-foreground hover:bg-secondary"
                            aria-label={
                              isOpen ? t('oneNote.collapseSections') : t('oneNote.expandSections')
                            }
                            onClick={(): void => toggleExpanded(row.notebookId)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-6 shrink-0" />
                        )}
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 flex-col rounded-md px-1 py-1.5 text-left text-sm hover:bg-secondary/80"
                          onClick={(): void =>
                            pick({
                              notebookId: row.notebookId,
                              sectionId: row.sectionId,
                              notebookName: row.notebookName,
                              sectionName: row.sectionName
                            })
                          }
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Notebook className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{row.title}</span>
                            {row.isDefaultNotebook && row.targetKind === 'notebook' ? (
                              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                {t('oneNote.badgeDefault')}
                              </span>
                            ) : null}
                            {row.isShared ? (
                              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {t('oneNote.badgeShared')}
                              </span>
                            ) : null}
                          </span>
                          <span className="truncate pl-5 text-xs text-muted-foreground">
                            {rowMeta(row)}
                          </span>
                        </button>
                      </div>
                      {isOpen ? (
                        <ul className="mb-1 ml-7">
                          {childSections.map((section) => (
                            <li key={section.id}>
                              <button
                                type="button"
                                className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/80"
                                onClick={(): void =>
                                  pick({
                                    notebookId: section.notebookId,
                                    sectionId: section.id,
                                    notebookName: section.notebookName,
                                    sectionName: section.displayName
                                  })
                                }
                              >
                                <span className="truncate">{section.displayName}</span>
                                {section.sectionGroupName ? (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {section.sectionGroupName}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {!loading && catalog && rows.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              {query.trim() ? t('oneNote.pickerNoResults') : t('oneNote.pickerEmpty')}
            </p>
          ) : null}
        </div>

        <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          {t('oneNote.footerHint')}
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
