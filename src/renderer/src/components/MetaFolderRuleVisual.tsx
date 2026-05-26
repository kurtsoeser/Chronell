import { Fragment } from 'react'
import { ArrowDown, Ban, Filter, FolderInput, Info, Layers, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetaFolderMatchExpressionEditor } from '@/components/MetaFolderMatchExpressionEditor'
import type { MetaFolderExcRowState, MetaFolderScopeFolderGroup } from '@/components/meta-folder-ui-types'
import {
  matchExpressionHasActiveFilter,
  matchExpressionSummaryDe,
  type MetaFolderConditionGroup
} from '@shared/meta-folder-match-expression'

function folderScopeLabel(
  folderScopeGroups: MetaFolderScopeFolderGroup[],
  folderId: number
): string {
  for (const g of folderScopeGroups) {
    const f = g.folders.find((x) => x.id === folderId)
    if (f) return `${f.name} (${g.accountLabel})`
  }
  return `#${folderId}`
}

function scopeSummaryDe(
  useScope: boolean,
  scopeFolderIds: number[],
  folderScopeGroups: MetaFolderScopeFolderGroup[]
): string {
  if (!useScope || scopeFolderIds.length === 0) {
    return 'Alle synchronisierten Ordner außer Papierkorb und Junk-E-Mail.'
  }
  const labels = scopeFolderIds
    .map((id) => folderScopeLabel(folderScopeGroups, id))
    .slice(0, 4)
  const more = scopeFolderIds.length > 4 ? ` … (+${scopeFolderIds.length - 4} weitere)` : ''
  return `Nur in ${scopeFolderIds.length} ausgewählten Ordnern: ${labels.join(', ')}${more}.`
}

export function buildMetaFolderRuleSummaryDe(args: {
  useScope: boolean
  scopeFolderIds: number[]
  folderScopeGroups: MetaFolderScopeFolderGroup[]
  matchRoot: MetaFolderConditionGroup
  exceptionRows: MetaFolderExcRowState[]
  exceptionsMatchOp: 'and' | 'or'
}): string {
  const {
    useScope,
    scopeFolderIds,
    folderScopeGroups,
    matchRoot,
    exceptionRows,
    exceptionsMatchOp
  } = args
  const parts: string[] = []
  parts.push(scopeSummaryDe(useScope, scopeFolderIds, folderScopeGroups))

  const matchSummary = matchExpressionSummaryDe(matchRoot)
  if (!matchSummary && !(useScope && scopeFolderIds.length > 0)) {
    parts.push('Filter: (noch keine Bedingung unter „Was?“).')
  } else if (matchSummary) {
    parts.push(`Was?: ${matchSummary}.`)
  }

  const exBits: string[] = []
  for (const r of exceptionRows) {
    const sub: string[] = []
    if (r.unread) sub.push('ungelesen')
    if (r.flagged) sub.push('markiert')
    if (r.attach) sub.push('mit Anhang')
    const rt = r.textQuery.trim()
    if (rt.length >= 2) sub.push(`Volltext „${rt}“`)
    const rf = r.from.trim()
    if (rf.length >= 2) sub.push(`Absender „${rf}“`)
    const internalJoin = r.matchOp === 'or' ? ' oder ' : ' und '
    if (sub.length > 0) exBits.push(`(${sub.join(internalJoin)})`)
  }
  if (exBits.length > 0) {
    const outerJoin = exceptionsMatchOp === 'or' ? ' oder ' : ' und '
    parts.push(`Was nicht? — ausschließen wenn ${exBits.join(outerJoin)}.`)
  }

  return parts.join(' ')
}

function FlowConnector(): JSX.Element {
  return (
    <div className="flex justify-center py-0.5">
      <ArrowDown className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
    </div>
  )
}

function StepBadge({ n, tone }: { n: number; tone: 'emerald' | 'sky' | 'rose' }): JSX.Element {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : tone === 'sky'
        ? 'border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-200'
        : 'border-rose-500/50 bg-rose-500/15 text-rose-800 dark:text-rose-200'
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
        cls
      )}
    >
      {n}
    </span>
  )
}

function RuleHintIcon({ text }: { text: string }): JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      title={text}
      aria-label="Hinweis"
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

function LogicToggle({
  label,
  value,
  onChange
}: {
  label?: string
  value: 'and' | 'or'
  onChange: (v: 'and' | 'or') => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-md bg-background/60 px-1 py-0.5 text-[10px]">
      {label && <span className="px-1 text-muted-foreground">{label}</span>}
      <button
        type="button"
        className={cn(
          'rounded px-1.5 py-0.5 font-semibold',
          value === 'and' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
        )}
        onClick={(): void => onChange('and')}
      >
        UND
      </button>
      <button
        type="button"
        className={cn(
          'rounded px-1.5 py-0.5 font-semibold',
          value === 'or' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
        )}
        onClick={(): void => onChange('or')}
      >
        ODER
      </button>
    </div>
  )
}

export interface MetaFolderRuleFlowProps {
  interactive: boolean
  useScope: boolean
  scopeFolderIds: number[]
  folderScopeGroups: MetaFolderScopeFolderGroup[]
  categoryOptions: string[]
  matchRoot: MetaFolderConditionGroup
  onMatchRootChange: (root: MetaFolderConditionGroup) => void
  exceptionRows: MetaFolderExcRowState[]
  exceptionsMatchOp: 'and' | 'or'
  onSetUseScope: (v: boolean) => void
  onToggleScopeFolder: (id: number) => void
  onSetExceptionsMatchOp: (v: 'and' | 'or') => void
  onUpdateExc: (id: string, patch: Partial<MetaFolderExcRowState>) => void
  onRemoveExc: (id: string) => void
  onAddExc: () => void
}

export function MetaFolderRuleFlow(props: MetaFolderRuleFlowProps): JSX.Element {
  const {
    interactive,
    useScope,
    scopeFolderIds,
    folderScopeGroups,
    categoryOptions,
    matchRoot,
    onMatchRootChange,
    exceptionRows,
    exceptionsMatchOp,
    onSetUseScope,
    onToggleScopeFolder,
    onSetExceptionsMatchOp,
    onUpdateExc,
    onRemoveExc,
    onAddExc
  } = props

  const scopeText = scopeSummaryDe(useScope, scopeFolderIds, folderScopeGroups)
  const totalFolderCount = folderScopeGroups.reduce((n, g) => n + g.folders.length, 0)

  const whatHintDe =
    'Zwischen Bedingungen auf UND oder ODER klicken, um die Verknuepfung umzustellen. ' +
    'Mit „Klammer — Untergruppe“ gruppieren, z. B. (Bedingung 1 UND Bedingung 2) ODER (Bedingung 3 ODER Bedingung 4). ' +
    'Zeilen innerhalb Volltext/Absender sind ODER.'

  function renderScopeStep(): JSX.Element {
    if (!interactive) {
      return <p className="mt-1 text-xs leading-snug text-muted-foreground">{scopeText}</p>
    }

    return (
      <div className="mt-2 space-y-2">
        {!useScope ? (
          <>
            <p className="text-xs leading-snug text-muted-foreground">{scopeText}</p>
            <button
              type="button"
              onClick={(): void => onSetUseScope(true)}
              className="w-full rounded border border-dashed border-emerald-600/40 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200"
            >
              + Bestimmte Ordner wählen
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {scopeFolderIds.length} Ordner ausgewählt
              </p>
              <button
                type="button"
                onClick={(): void => onSetUseScope(false)}
                className="shrink-0 text-[10px] font-medium text-muted-foreground underline hover:text-foreground"
              >
                Standard (alle)
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto rounded-md border border-input/60 bg-background/70 p-1.5">
              {totalFolderCount === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Keine Ordner geladen.</p>
              ) : (
                folderScopeGroups.map((group) => (
                  <div key={group.accountId} className="mb-2 last:mb-0">
                    <div className="sticky top-0 z-[1] truncate bg-background/95 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {group.accountLabel}
                    </div>
                    <div className="space-y-0.5 pl-1">
                      {group.folders.map((f) => (
                        <label
                          key={f.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-secondary/50"
                        >
                          <input
                            type="checkbox"
                            checked={scopeFolderIds.includes(f.id)}
                            onChange={(): void => onToggleScopeFolder(f.id)}
                            className="rounded border-input"
                          />
                          <span className="truncate text-xs">{f.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-gradient-to-b from-muted/30 to-card/80 p-3 shadow-inner">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Regel aufbauen
      </div>

      <div className="flex flex-col">
        <div className="flex gap-2">
          <StepBadge n={1} tone="emerald" />
          <div className="min-w-0 flex-1 rounded-lg border-l-4 border-l-emerald-500 bg-emerald-500/[0.07] px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FolderInput className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Wo suchen?
            </div>
            {renderScopeStep()}
          </div>
        </div>

        <FlowConnector />

        <div className="flex gap-2">
          <StepBadge n={2} tone="sky" />
          <div className="min-w-0 flex-1 space-y-2 rounded-lg border-l-4 border-l-sky-500 bg-sky-500/[0.07] px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Filter className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              Was?
              {interactive && <RuleHintIcon text={whatHintDe} />}
            </div>
            {interactive ? (
              <MetaFolderMatchExpressionEditor
                root={matchRoot}
                onChange={onMatchRootChange}
                categoryOptions={categoryOptions}
              />
            ) : matchExpressionHasActiveFilter(matchRoot) ? (
              <p className="text-xs text-muted-foreground">{matchExpressionSummaryDe(matchRoot)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        </div>

        <FlowConnector />

        <div className="flex gap-2">
          <StepBadge n={3} tone="rose" />
          <div className="min-w-0 flex-1 space-y-2 rounded-lg border-l-4 border-l-rose-500 bg-rose-500/[0.06] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Ban className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                Was nicht?
              </div>
              {interactive && exceptionRows.length > 1 && (
                <LogicToggle
                  label="Zwischen Karten"
                  value={exceptionsMatchOp}
                  onChange={onSetExceptionsMatchOp}
                />
              )}
            </div>
            <div className="space-y-2">
              {exceptionRows.map((row, idx) => (
                <Fragment key={row.id}>
                  {idx > 0 && (
                    <div className="flex items-center gap-2 py-0.5">
                      <div className="h-px flex-1 bg-rose-500/25" />
                      <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        {exceptionsMatchOp === 'or' ? 'oder' : 'und'}
                      </span>
                      <div className="h-px flex-1 bg-rose-500/25" />
                    </div>
                  )}
                  <div className="relative rounded-lg border border-rose-500/25 bg-background/70 p-2 shadow-sm">
                    {interactive && (
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        onClick={(): void => onRemoveExc(row.id)}
                        aria-label="Ausnahme entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {interactive && (
                      <div className="mb-2 flex items-center justify-end pr-6">
                        <LogicToggle
                          label="In dieser Karte"
                          value={row.matchOp}
                          onChange={(v): void => onUpdateExc(row.id, { matchOp: v })}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pr-6">
                      <label className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.unread}
                          disabled={!interactive}
                          onChange={(e): void => onUpdateExc(row.id, { unread: e.target.checked })}
                          className="rounded border-input"
                        />
                        <span className="text-xs">Ungelesen</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.flagged}
                          disabled={!interactive}
                          onChange={(e): void => onUpdateExc(row.id, { flagged: e.target.checked })}
                          className="rounded border-input"
                        />
                        <span className="text-xs">Markiert</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.attach}
                          disabled={!interactive}
                          onChange={(e): void => onUpdateExc(row.id, { attach: e.target.checked })}
                          className="rounded border-input"
                        />
                        <span className="text-xs">Anhang</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={row.textQuery}
                      disabled={!interactive}
                      onChange={(e): void => onUpdateExc(row.id, { textQuery: e.target.value })}
                      placeholder="Volltext in dieser Ausnahme"
                      className="mt-2 w-full rounded border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    />
                    <input
                      type="text"
                      value={row.from}
                      disabled={!interactive}
                      onChange={(e): void => onUpdateExc(row.id, { from: e.target.value })}
                      placeholder="Absender enthält"
                      className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
            {interactive && (
              <button
                type="button"
                onClick={onAddExc}
                className="w-full rounded border border-dashed border-rose-500/40 py-1.5 text-xs font-medium text-rose-800/90 hover:bg-rose-500/10 dark:text-rose-200/90"
              >
                + Ausnahme hinzufügen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
