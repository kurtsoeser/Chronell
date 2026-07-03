import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckSquare,
  Loader2,
  Mail,
  StickyNote,
  User,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  NoteEntityLinkTarget,
  NoteEntityLinkTargetKind,
  NoteLinkTargetCandidate,
  NoteLinksBundle
} from '@shared/note-entity-links'
import { EntityLinkFilterTabs } from '@/components/EntityLinkFilterTabs'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

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

export function NoteEntityLinkPickerDialog({
  noteId,
  open,
  onClose,
  onLinked
}: {
  noteId: number
  open: boolean
  onClose: () => void
  onLinked?: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const [bundle, setBundle] = useState<NoteLinksBundle>({ outgoing: [], incoming: [] })
  const [pickerKind, setPickerKind] = useState<NoteEntityLinkTargetKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<NoteLinkTargetCandidate[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPickerKind('all')
    setSearch('')
    void window.mailClient.notes.links
      .list(noteId)
      .then(setBundle)
      .catch(() => setBundle({ outgoing: [], incoming: [] }))
  }, [open, noteId])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void window.mailClient.notes.links
        .searchTargets({ query: search.trim(), excludeNoteId: noteId, limit: 40 })
        .then((rows) => {
          const linkedKeys = new Set(bundle.outgoing.map((item) => JSON.stringify(item.target)))
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
  }, [open, search, noteId, pickerKind, bundle.outgoing])

  async function addLink(target: NoteEntityLinkTarget): Promise<void> {
    setBusy(true)
    try {
      await window.mailClient.notes.links.add({ fromNoteId: noteId, target })
      onLinked?.()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalRoot open={open} zIndex={320} overlayClassName="p-4" onBackdropClick={onClose}>
      <ModalPanel
        aria-labelledby="note-link-picker-title"
        className="chronell-dialog-panel flex max-h-[min(520px,90vh)] w-full max-w-md flex-col overflow-hidden text-popover-foreground"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="note-link-picker-title" className="text-sm font-semibold">
            {t('notes.pagesContextMenu.linkDialogTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <EntityLinkFilterTabs value={pickerKind} onChange={setPickerKind} kinds={PICKER_KINDS} />

          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('notes.links.searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            autoFocus
          />

          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {candidates.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">{t('notes.links.noCandidates')}</p>
            ) : (
              candidates.map((c) => {
                const Icon = kindIcon(c.target.kind)
                return (
                  <button
                    key={JSON.stringify(c.target)}
                    type="button"
                    disabled={busy}
                    onClick={(): void => void addLink(c.target)}
                    className="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-xs hover:bg-secondary/50 last:border-0 disabled:opacity-50"
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

        {busy ? (
          <footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </footer>
        ) : null}
      </ModalPanel>
    </ModalRoot>
  )
}