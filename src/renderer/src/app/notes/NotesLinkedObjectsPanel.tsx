import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckSquare,
  Eye,
  Link2,
  Loader2,
  Mail,
  Plus,
  StickyNote,
  User
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  NoteEntityLinkTarget,
  NoteEntityLinkedItem,
  NoteLinkTargetCandidate,
  NoteLinksBundle,
  NoteEntityLinkTargetKind
} from '@shared/note-entity-links'
import { mergeNoteLinksWithBodyMentions } from '@/app/notes/notes-link-preview-items'
import { cn } from '@/lib/utils'
import { EntityLinkFilterTabs } from '@/components/EntityLinkFilterTabs'
import { NoteEntityLinkChip } from '@/components/NoteEntityLinkChip'
import { noteEntityLinkTargetKey } from '@shared/note-entity-links'
import { openNoteEntityLinkTarget } from '@/lib/note-entity-link-nav'
import { subscribeEntityLinksChanged } from '@/lib/entity-links-client'
import { useAppModeStore } from '@/stores/app-mode'

const PICKER_KINDS: NoteEntityLinkTargetKind[] = [
  'note',
  'mail',
  'calendar_event',
  'cloud_task',
  'people_contact'
]

function kindIcon(kind: NoteEntityLinkTargetKind): typeof StickyNote {
  if (kind === 'mail') return Mail
  if (kind === 'calendar_event') return CalendarDays
  if (kind === 'cloud_task') return CheckSquare
  if (kind === 'people_contact') return User
  return StickyNote
}

export function NotesLinkedObjectsPanel({
  noteId,
  onOpenNote,
  selectedPreviewKey,
  onSelectForPreview,
  onLinksLoaded,
  previewOpen,
  onTogglePreview,
  variant = 'card',
  className,
  bodyHtml
}: {
  noteId: number
  onOpenNote: (id: number) => void
  selectedPreviewKey?: string | null
  onSelectForPreview?: (item: NoteEntityLinkedItem, direction: 'outgoing' | 'incoming') => void
  onLinksLoaded?: (bundle: NoteLinksBundle) => void
  previewOpen?: boolean
  onTogglePreview?: () => void
  variant?: 'card' | 'onenote'
  className?: string
  /** Gespeicherter Notiz-HTML-Body – ergänzt @-Erwähnungen (z. B. Kontakte) in der Kachelansicht. */
  bodyHtml?: string
}): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const embedded = variant === 'onenote'
  const [bundle, setBundle] = useState<NoteLinksBundle>({ outgoing: [], incoming: [] })
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerKind, setPickerKind] = useState<NoteEntityLinkTargetKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<NoteLinkTargetCandidate[]>([])
  const [busy, setBusy] = useState(false)
  const outgoingItems = useMemo(
    () => mergeNoteLinksWithBodyMentions(bundle.outgoing, bodyHtml, noteId),
    [bundle.outgoing, bodyHtml, noteId]
  )

  const loadLinks = useCallback(async (opts?: { silent?: boolean }): Promise<void> => {
    if (!opts?.silent) setLoading(true)
    try {
      const next = await window.mailClient.notes.links.list(noteId)
      setBundle(next)
      onLinksLoaded?.(next)
    } catch {
      const empty = { outgoing: [], incoming: [] }
      setBundle(empty)
      onLinksLoaded?.(empty)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [noteId, onLinksLoaded])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  useEffect(() => {
    return subscribeEntityLinksChanged(() => {
      void loadLinks({ silent: true })
    })
  }, [loadLinks])

  useEffect(() => {
    if (!pickerOpen) return
    const handle = window.setTimeout(() => {
      void window.mailClient.notes.links
        .searchTargets({ query: search.trim(), excludeNoteId: noteId, limit: 40 })
        .then((rows) => {
          const linkedKeys = new Set(
            outgoingItems.map((item) => JSON.stringify(item.target))
          )
          setCandidates(
            rows.filter((c) => {
              if (pickerKind !== 'all' && c.target.kind !== pickerKind) return false
              return !linkedKeys.has(JSON.stringify(c.target))
            })
          )
        })
        .catch(() => setCandidates([]))
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [pickerOpen, search, noteId, pickerKind, outgoingItems])

  async function addLink(target: NoteEntityLinkTarget): Promise<void> {
    setBusy(true)
    try {
      await window.mailClient.notes.links.add({ fromNoteId: noteId, target })
      setPickerOpen(false)
      setSearch('')
      await loadLinks()
    } finally {
      setBusy(false)
    }
  }

  async function removeOutgoing(linkId: number, target?: NoteEntityLinkTarget): Promise<void> {
    const resolvedLinkId =
      linkId > 0
        ? linkId
        : target
          ? bundle.outgoing.find(
              (item) => noteEntityLinkTargetKey(item.target) === noteEntityLinkTargetKey(target)
            )?.linkId
          : undefined
    if (!resolvedLinkId) return
    setBusy(true)
    try {
      await window.mailClient.notes.links.remove({
        fromNoteId: noteId,
        linkId: resolvedLinkId,
        direction: 'outgoing'
      })
      await loadLinks()
    } finally {
      setBusy(false)
    }
  }

  async function removeIncoming(linkId: number): Promise<void> {
    setBusy(true)
    try {
      await window.mailClient.notes.links.remove({ fromNoteId: noteId, linkId, direction: 'incoming' })
      await loadLinks()
    } finally {
      setBusy(false)
    }
  }

  async function openLink(item: NoteEntityLinkedItem): Promise<void> {
    if (item.target.kind === 'note') {
      onOpenNote(item.target.noteId)
      return
    }
    await openNoteEntityLinkTarget(item.target, setAppMode)
  }

  function renderLinkChip(
    item: NoteEntityLinkedItem,
    direction: 'outgoing' | 'incoming',
    onRemove: (linkId: number, target?: NoteEntityLinkTarget) => void
  ): JSX.Element {
    const kind = item.target.kind
    const key = noteEntityLinkTargetKey(item.target)
    const selected = selectedPreviewKey === key
    const kindLabel = t(`notes.links.kind.${kind}`)
    const meta =
      item.subtitle === 'subpage'
        ? `${kindLabel} · ${t('notes.subPages.create')}`
        : item.subtitle && kind !== 'note'
          ? `${kindLabel} · ${item.subtitle}`
          : kindLabel

    return (
      <NoteEntityLinkChip
        key={`${direction}-${key}`}
        kind={kind}
        title={item.title}
        meta={meta}
        selected={selected}
        busy={busy}
        previewTitle={t('notes.preview.showInPane')}
        openTitle={t('notes.preview.openExternal')}
        removeTitle={t('notes.links.remove')}
        onSelect={
          onSelectForPreview ? (): void => onSelectForPreview(item, direction) : undefined
        }
        onOpen={(): void => void openLink(item)}
        onRemove={
          direction === 'outgoing'
            ? (): void => void onRemove(item.linkId, item.target)
            : (): void => void onRemove(item.linkId)
        }
      />
    )
  }

  const actionButtons = (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {onTogglePreview ? (
        <button
          type="button"
          onClick={onTogglePreview}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-secondary',
            previewOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-foreground'
          )}
          title={t('notes.preview.togglePane')}
        >
          <Eye className="h-3 w-3" />
          {t('notes.preview.togglePaneShort')}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={(): void => setPickerOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary"
      >
        <Plus className="h-3 w-3" />
        {t('notes.links.add')}
      </button>
    </div>
  )

  const picker = pickerOpen ? (
    <div className="space-y-2">
      <EntityLinkFilterTabs value={pickerKind} onChange={setPickerKind} kinds={PICKER_KINDS} />
      <input
        type="search"
        value={search}
        onChange={(e): void => setSearch(e.target.value)}
        placeholder={t('notes.links.searchPlaceholder')}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      />
      <div className="max-h-44 overflow-y-auto rounded-md border border-border">
        {candidates.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">{t('notes.links.noCandidates')}</div>
        ) : (
          candidates.map((c) => {
            const Icon = kindIcon(c.target.kind)
            return (
              <button
                key={JSON.stringify(c.target)}
                type="button"
                disabled={busy}
                onClick={(): void => void addLink(c.target)}
                className="flex w-full items-center gap-2 border-b border-border/50 px-2 py-1.5 text-left text-xs hover:bg-secondary/50 last:border-0"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {t(`notes.links.kind.${c.target.kind}`)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  ) : null

  const renderLink = renderLinkChip
  const linkListClass = 'flex flex-wrap gap-1.5'

  const linksBody = loading ? (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('common.loading')}
    </div>
  ) : (
    <>
      <div>
        {!embedded ? (
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('notes.links.outgoing')}
          </p>
        ) : null}
        {outgoingItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('notes.links.emptyOutgoing')}</p>
        ) : (
          <div className={linkListClass}>
            {outgoingItems.map((item) => renderLink(item, 'outgoing', removeOutgoing))}
          </div>
        )}
      </div>
      {bundle.incoming.length > 0 ? (
        <div>
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('notes.links.incoming')}
          </p>
          <div className={linkListClass}>
            {bundle.incoming.map((item) => renderLink(item, 'incoming', removeIncoming))}
          </div>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">{linksBody}</div>
          <div className="shrink-0">{actionButtons}</div>
        </div>
        {picker}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border bg-background/60 p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Link2 className="h-3.5 w-3.5" />
          {t('notes.links.title')}
        </div>
        {actionButtons}
      </div>

      {picker ? <div className="mt-2">{picker}</div> : null}

      <div className="mt-2 space-y-2">{linksBody}</div>
    </div>
  )
}
