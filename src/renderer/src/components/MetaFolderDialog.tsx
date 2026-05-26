import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import type { MetaFolderExcRowState, MetaFolderScopeFolderGroup } from '@/components/meta-folder-ui-types'
import { buildMetaFolderRuleSummaryDe, MetaFolderRuleFlow } from '@/components/MetaFolderRuleVisual'
import {
  createEmptyMatchRoot,
  legacyCriteriaToMatchExpression,
  matchExpressionHasActiveFilter,
  validateMatchExpression,
  type MetaFolderConditionGroup
} from '@shared/meta-folder-match-expression'
import type {
  ConnectedAccount,
  MailFolder,
  MetaFolderCriteria,
  MetaFolderCreateInput,
  MetaFolderExceptionClause,
  MetaFolderSummary,
  MetaFolderUpdateInput
} from '@shared/types'

function newExcRow(): MetaFolderExcRowState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    textQuery: '',
    unread: false,
    flagged: false,
    attach: false,
    from: '',
    matchOp: 'and'
  }
}

function exceptionRowToClause(r: MetaFolderExcRowState): MetaFolderExceptionClause | null {
  const c: MetaFolderExceptionClause = {}
  if (r.unread) c.unreadOnly = true
  if (r.flagged) c.flaggedOnly = true
  if (r.attach) c.hasAttachmentsOnly = true
  c.matchOp = r.matchOp
  const t = r.textQuery.trim()
  if (t.length >= 2) c.textQuery = t
  const f = r.from.trim()
  if (f.length >= 2) c.fromContains = f
  if (!c.unreadOnly && !c.flaggedOnly && !c.hasAttachmentsOnly && !c.textQuery && !c.fromContains) {
    return null
  }
  return c
}

function validateExceptionRows(rows: MetaFolderExcRowState[]): string | null {
  for (const r of rows) {
    const t = r.textQuery.trim()
    const f = r.from.trim()
    const any = r.unread || r.flagged || r.attach || t.length > 0 || f.length > 0
    if (!any) continue
    if (t.length === 1) return 'Ausnahme: Volltext braucht mindestens zwei Zeichen.'
    if (f.length === 1) return 'Ausnahme: Absender-Teilstring braucht mindestens zwei Zeichen.'
    if (!r.unread && !r.flagged && !r.attach && t.length < 2 && f.length < 2) {
      return 'Ausnahme: jede befuellte Karte braucht mindestens einen gueltigen Filter.'
    }
  }
  return null
}

function clauseToExcRow(cl: MetaFolderExceptionClause): MetaFolderExcRowState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    textQuery: cl.textQuery?.trim() ?? '',
    unread: cl.unreadOnly === true,
    flagged: cl.flaggedOnly === true,
    attach: cl.hasAttachmentsOnly === true,
    from: cl.fromContains?.trim() ?? '',
    matchOp: cl.matchOp === 'or' ? 'or' : 'and'
  }
}

interface Props {
  open: boolean
  editing: MetaFolderSummary | null
  accounts: ConnectedAccount[]
  foldersByAccount: Record<string, MailFolder[]>
  onClose: () => void
  onCreate: (input: MetaFolderCreateInput) => Promise<void>
  onUpdate: (input: MetaFolderUpdateInput) => Promise<void>
}

function localValidate(
  name: string,
  matchRoot: MetaFolderConditionGroup,
  useScope: boolean,
  scopeFolderIds: number[],
  exceptionRows: MetaFolderExcRowState[]
): string | null {
  const n = name.trim()
  if (n.length < 1) return 'Bitte einen Namen eingeben.'
  if (useScope && scopeFolderIds.length === 0) {
    return 'Ordner: mindestens einen Ordner waehlen oder wieder auf Standard stellen.'
  }
  const exprErr = validateMatchExpression(matchRoot)
  if (exprErr) return exprErr
  const exErr = validateExceptionRows(exceptionRows)
  if (exErr) return exErr
  const hasMatch =
    matchExpressionHasActiveFilter(matchRoot) || (useScope && scopeFolderIds.length > 0)
  if (!hasMatch) {
    return 'Unter „Was?“ mindestens eine Bedingung hinzufuegen (oder Ordner unter „Wo suchen?“ einschraenken).'
  }
  return null
}

export function MetaFolderDialog({
  open,
  editing,
  accounts,
  foldersByAccount,
  onClose,
  onCreate,
  onUpdate
}: Props): JSX.Element | null {
  const isEdit = editing != null
  const [name, setName] = useState('')
  const [matchRoot, setMatchRoot] = useState<MetaFolderConditionGroup>(() => createEmptyMatchRoot())
  const [useScope, setUseScope] = useState(false)
  const [scopeFolderIds, setScopeFolderIds] = useState<number[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [exceptionRows, setExceptionRows] = useState<MetaFolderExcRowState[]>([])
  const [exceptionsMatchOp, setExceptionsMatchOp] = useState<'and' | 'or'>('or')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      const c = editing.criteria
      setMatchRoot(legacyCriteriaToMatchExpression(c))
      const scope = (c.scopeFolderIds ?? []).filter((id) => Number.isFinite(id) && id > 0)
      setUseScope(scope.length > 0)
      setScopeFolderIds(scope)
      setExceptionRows((c.exceptions ?? []).map(clauseToExcRow))
      setExceptionsMatchOp(c.exceptionsMatchOp === 'and' ? 'and' : 'or')
      setError(null)
      setBusy(false)
      return
    }
    setName('')
    setMatchRoot(createEmptyMatchRoot())
    setUseScope(false)
    setScopeFolderIds([])
    setCategoryOptions([])
    setExceptionRows([])
    setExceptionsMatchOp('or')
    setError(null)
    setBusy(false)
  }, [open, editing?.id, editing?.updatedAt])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const collected: string[] = []
        for (const acc of accounts) {
          if (acc.provider === 'microsoft') {
            const masters = await window.mailClient.mail.listMasterCategories(acc.id)
            collected.push(...masters.map((m) => m.displayName))
          } else {
            const tags = await window.mailClient.mail.listDistinctMessageTags(acc.id)
            collected.push(...tags)
          }
        }
        const uniq = Array.from(
          new Set(collected.map((x) => x.trim()).filter((x) => x.length > 0))
        ).sort((a, b) => a.localeCompare(b, 'de'))
        if (!cancelled) setCategoryOptions(uniq)
      } catch {
        if (!cancelled) setCategoryOptions([])
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [open, accounts])

  const folderScopeGroups = useMemo((): MetaFolderScopeFolderGroup[] => {
    const groups: MetaFolderScopeFolderGroup[] = []
    for (const acc of accounts) {
      const folders = foldersByAccount[acc.id] ?? []
      if (folders.length === 0) continue
      const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, 'de'))
      groups.push({
        accountId: acc.id,
        accountLabel: acc.email,
        folders: sorted.map((f) => ({ id: f.id, name: f.name }))
      })
    }
    groups.sort((a, b) => a.accountLabel.localeCompare(b.accountLabel, 'de'))
    return groups
  }, [accounts, foldersByAccount])

  const ruleSummaryDe = useMemo(
    () =>
      buildMetaFolderRuleSummaryDe({
        useScope,
        scopeFolderIds,
        folderScopeGroups,
        matchRoot,
        exceptionRows,
        exceptionsMatchOp
      }),
    [useScope, scopeFolderIds, folderScopeGroups, matchRoot, exceptionRows, exceptionsMatchOp]
  )

  if (!open) return null

  async function handleSubmit(): Promise<void> {
    const err = localValidate(name, matchRoot, useScope, scopeFolderIds, exceptionRows)
    if (err) {
      setError(err)
      return
    }
    const criteria: MetaFolderCriteria = {
      matchExpression: matchRoot,
      ...(useScope && scopeFolderIds.length > 0 ? { scopeFolderIds } : {})
    }
    const exceptions = exceptionRows
      .map(exceptionRowToClause)
      .filter((x): x is MetaFolderExceptionClause => x != null)
    if (exceptions.length > 0) {
      criteria.exceptions = exceptions
      criteria.exceptionsMatchOp = exceptionsMatchOp
    }
    setBusy(true)
    setError(null)
    try {
      if (isEdit && editing) {
        await onUpdate({ id: editing.id, name: name.trim(), criteria })
      } else {
        await onCreate({ name: name.trim(), criteria })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function toggleScopeFolder(id: number): void {
    setScopeFolderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <ModalRoot open={open} zIndex={50} onBackdropClick={onClose}>
      <ModalPanel className="flex min-h-[min(75vh,780px)] max-h-[90vh] w-[min(520px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">{isEdit ? 'Meta-Ordner bearbeiten' : 'Neuer Meta-Ordner'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Virtuelle Ansicht ueber alle Konten — Mails werden nicht verschoben.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
          <div>
            <label className="mb-1.5 block font-medium text-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e): void => setName(e.target.value)}
              placeholder="Namen des Meta-Ordners eingeben"
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs outline-none ring-primary focus-visible:ring-2"
              maxLength={120}
            />
          </div>

          <MetaFolderRuleFlow
            key={editing?.id ?? 'new'}
            interactive
            useScope={useScope}
            scopeFolderIds={scopeFolderIds}
            folderScopeGroups={folderScopeGroups}
            categoryOptions={categoryOptions}
            matchRoot={matchRoot}
            onMatchRootChange={setMatchRoot}
            exceptionRows={exceptionRows}
            exceptionsMatchOp={exceptionsMatchOp}
            onSetUseScope={(v): void => {
              setUseScope(v)
              if (!v) setScopeFolderIds([])
            }}
            onToggleScopeFolder={toggleScopeFolder}
            onSetExceptionsMatchOp={setExceptionsMatchOp}
            onUpdateExc={(id, patch): void =>
              setExceptionRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
            }
            onRemoveExc={(id): void => setExceptionRows((prev) => prev.filter((x) => x.id !== id))}
            onAddExc={(): void => setExceptionRows((prev) => [...prev, newExcRow()])}
          />

          <p className="rounded-md bg-muted/25 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
            {ruleSummaryDe}
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(): void => void handleSubmit()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground',
              'hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
