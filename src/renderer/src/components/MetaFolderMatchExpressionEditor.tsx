import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  MailOpen,
  Paperclip,
  Search,
  Star,
  Tag,
  UserRound,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addChildToMatchGroup,
  createMatchGroup,
  createMatchLeaf,
  removeMatchNode,
  updateMatchGroup,
  updateMatchNode,
  type MetaFolderConditionGroup,
  type MetaFolderConditionLeaf,
  type MetaFolderConditionNode,
  type MetaFolderConditionType,
  type MetaFolderMatchOp
} from '@shared/meta-folder-match-expression'

function JoinPillToggle({
  op,
  onToggle
}: {
  op: MetaFolderMatchOp
  onToggle: () => void
}): JSX.Element {
  const label = op === 'or' ? 'ODER' : 'UND'
  return (
    <button
      type="button"
      title="Klicken zum Umschalten zwischen UND und ODER"
      aria-label={`Verknuepfung: ${label}. Klicken zum Umschalten.`}
      onClick={onToggle}
      className={cn(
        'shrink-0 rounded-full border border-dashed px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition',
        'border-primary/55 bg-primary/10 text-primary hover:bg-primary/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
    >
      {label}
    </button>
  )
}

function AddConditionMenu({
  groupId,
  root,
  onChange,
  existingTypes
}: {
  groupId: string
  root: MetaFolderConditionGroup
  onChange: (root: MetaFolderConditionGroup) => void
  existingTypes: Set<MetaFolderConditionType>
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function add(type: MetaFolderConditionType): void {
    onChange(addChildToMatchGroup(root, groupId, createMatchLeaf(type)))
    setOpen(false)
  }

  function addGroup(): void {
    onChange(addChildToMatchGroup(root, groupId, createMatchGroup('and')))
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(): void => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        + Bedingung
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="chronell-acrylic-popover absolute left-0 top-full z-30 mt-1 min-w-[200px] py-1 text-xs">
          {!existingTypes.has('unread') && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
              onClick={(): void => add('unread')}
            >
              <MailOpen className="h-3.5 w-3.5" /> Ungelesen
            </button>
          )}
          {!existingTypes.has('flagged') && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
              onClick={(): void => add('flagged')}
            >
              <Star className="h-3.5 w-3.5" /> Markiert
            </button>
          )}
          {!existingTypes.has('attachments') && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
              onClick={(): void => add('attachments')}
            >
              <Paperclip className="h-3.5 w-3.5" /> Mit Anhang
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
            onClick={(): void => add('fulltext')}
          >
            <Search className="h-3.5 w-3.5" /> Volltext
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
            onClick={(): void => add('from')}
          >
            <UserRound className="h-3.5 w-3.5" /> Absender enthält
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
            onClick={(): void => add('categories')}
          >
            <Tag className="h-3.5 w-3.5" /> Kategorien
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-medium hover:bg-secondary"
            onClick={addGroup}
          >
            ( ) Klammer — Untergruppe
          </button>
        </div>
      )}
    </div>
  )
}

function collectLeafTypesInGroup(group: MetaFolderConditionGroup): Set<MetaFolderConditionType> {
  const s = new Set<MetaFolderConditionType>()
  for (const ch of group.children) {
    if (ch.kind === 'leaf' && (ch.type === 'unread' || ch.type === 'flagged' || ch.type === 'attachments')) {
      s.add(ch.type)
    }
  }
  return s
}

function LeafEditor({
  leaf,
  root,
  onChange,
  categoryOptions
}: {
  leaf: MetaFolderConditionLeaf
  root: MetaFolderConditionGroup
  onChange: (root: MetaFolderConditionGroup) => void
  categoryOptions: string[]
}): JSX.Element {
  function patch(p: Partial<MetaFolderConditionLeaf>): void {
    onChange(
      updateMatchNode(root, leaf.id, (n) =>
        n.kind === 'leaf' ? { ...n, ...p } : n
      )
    )
  }

  if (leaf.type === 'unread' || leaf.type === 'flagged' || leaf.type === 'attachments') {
    const label =
      leaf.type === 'unread' ? 'Ungelesen' : leaf.type === 'flagged' ? 'Markiert' : 'Mit Anhang'
    const Icon = leaf.type === 'unread' ? MailOpen : leaf.type === 'flagged' ? Star : Paperclip
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        {label}
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          onClick={(): void => onChange(removeMatchNode(root, leaf.id))}
          aria-label="Entfernen"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (leaf.type === 'fulltext' || leaf.type === 'from') {
    const lines = leaf.lines ?? ['']
    const isFt = leaf.type === 'fulltext'
    return (
      <div className="inline-flex min-w-[160px] max-w-full flex-col gap-1.5 rounded-lg border border-border bg-background/90 px-2 py-1.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isFt ? <Search className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
          {isFt ? 'Volltext' : 'Absender enthält'}
          <button
            type="button"
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            onClick={(): void => onChange(removeMatchNode(root, leaf.id))}
            aria-label="Entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {lines.map((line, idx) => (
            <Fragment key={idx}>
              {idx > 0 && (
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  oder
                </span>
              )}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={line}
                  onChange={(e): void => {
                    const next = [...lines]
                    next[idx] = e.target.value
                    patch({ lines: next })
                  }}
                  placeholder={isFt ? (idx === 0 ? 'Suchbegriff…' : 'Alternative…') : idx === 0 ? 'E-Mail oder Name…' : 'Alternative…'}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="shrink-0 rounded px-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    onClick={(): void => {
                      const next = lines.filter((_, i) => i !== idx)
                      patch({ lines: next.length > 0 ? next : [''] })
                    }}
                    aria-label="Zeile entfernen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Fragment>
          ))}
        </div>
        <button
          type="button"
          onClick={(): void => patch({ lines: [...lines, ''] })}
          className="rounded border border-dashed border-primary/40 py-1 text-2xs font-medium text-primary hover:bg-primary/10"
        >
          + Weitere Zeile (ODER)
        </button>
      </div>
    )
  }

  const cats = leaf.categoryNames ?? []
  return (
    <div className="inline-flex min-w-[160px] max-w-full flex-col gap-1.5 rounded-lg border border-border bg-background/90 px-2 py-1.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Tag className="h-3 w-3 shrink-0" />
        Kategorien
        <button
          type="button"
          className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          onClick={(): void => onChange(removeMatchNode(root, leaf.id))}
          aria-label="Entfernen"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cats.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary"
            >
              {cat}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-destructive/15 hover:text-destructive"
                onClick={(): void =>
                  patch({ categoryNames: cats.filter((c) => c !== cat) })
                }
                aria-label={`${cat} entfernen`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-28 overflow-y-auto rounded border border-input/60 bg-background/50 p-1">
        {categoryOptions.length === 0 ? (
          <p className="px-1 py-1 text-2xs text-muted-foreground">Keine Kategorien geladen.</p>
        ) : (
          categoryOptions.map((catName) => (
            <label
              key={catName}
              className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-secondary/50"
            >
              <input
                type="checkbox"
                checked={cats.includes(catName)}
                onChange={(): void => {
                  const s = new Set(cats)
                  if (s.has(catName)) s.delete(catName)
                  else s.add(catName)
                  patch({
                    categoryNames: Array.from(s).sort((a, b) => a.localeCompare(b, 'de'))
                  })
                }}
                className="rounded border-input"
              />
              <span className="truncate text-xs">{catName}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

function GroupEditor({
  group,
  root,
  onChange,
  categoryOptions,
  depth
}: {
  group: MetaFolderConditionGroup
  root: MetaFolderConditionGroup
  onChange: (root: MetaFolderConditionGroup) => void
  categoryOptions: string[]
  depth: number
}): JSX.Element {
  const isRoot = group.id === root.id
  const existingTypes = collectLeafTypesInGroup(group)

  function toggleGroupOp(): void {
    onChange(
      updateMatchGroup(root, group.id, (g) => ({
        ...g,
        op: g.op === 'or' ? 'and' : 'or'
      }))
    )
  }

  return (
    <div
      className={cn(
        'space-y-2',
        !isRoot && 'rounded-lg border border-sky-500/35 border-dashed bg-sky-500/[0.04] p-2'
      )}
    >
      {!isRoot && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-sky-600/90 dark:text-sky-300">(</span>
          <button
            type="button"
            className="text-[10px] font-medium text-muted-foreground underline hover:text-destructive"
            onClick={(): void => onChange(removeMatchNode(root, group.id))}
          >
            Klammer aufloesen
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {group.children.map((child, idx) => (
          <Fragment key={child.id}>
            {idx > 0 && <JoinPillToggle op={group.op} onToggle={toggleGroupOp} />}
            {child.kind === 'group' ? (
              <GroupEditor
                group={child}
                root={root}
                onChange={onChange}
                categoryOptions={categoryOptions}
                depth={depth + 1}
              />
            ) : (
              <LeafEditor
                leaf={child}
                root={root}
                onChange={onChange}
                categoryOptions={categoryOptions}
              />
            )}
          </Fragment>
        ))}
        <AddConditionMenu
          groupId={group.id}
          root={root}
          onChange={onChange}
          existingTypes={existingTypes}
        />
      </div>

      {!isRoot && (
        <span className="text-[10px] font-bold text-sky-600/90 dark:text-sky-300">)</span>
      )}
    </div>
  )
}

export interface MetaFolderMatchExpressionEditorProps {
  root: MetaFolderConditionGroup
  onChange: (root: MetaFolderConditionGroup) => void
  categoryOptions: string[]
}

export function MetaFolderMatchExpressionEditor({
  root,
  onChange,
  categoryOptions
}: MetaFolderMatchExpressionEditorProps): JSX.Element {
  return (
    <GroupEditor
      group={root}
      root={root}
      onChange={onChange}
      categoryOptions={categoryOptions}
      depth={0}
    />
  )
}
