import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, GripHorizontal, Loader2, Save, StickyNote, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  IPC,
  type UserNote,
  type UserNoteCalendarSource,
  type UserNotePeopleContactUpsertInput
} from '@shared/types'
import { cn } from '@/lib/utils'
import { useUndoStore } from '@/stores/undo'
import { MarkdownNoteEditorLazy } from './MarkdownNoteEditorLazy'
import type { MarkdownNoteEditorLayout } from './MarkdownNoteEditor'
import { NotesAttachmentsPanel } from '@/app/notes/NotesAttachmentsPanel'

export type ObjectNoteTarget =
  | {
      kind: 'mail'
      messageId: number
      title?: string | null
    }
  | {
      kind: 'calendar'
      accountId: string
      calendarSource: UserNoteCalendarSource
      calendarRemoteId: string
      eventRemoteId: string
      eventTitleSnapshot?: string | null
      eventStartIsoSnapshot?: string | null
      title?: string | null
    }
  | {
      kind: 'people_contact'
      contactId: number
      title?: string | null
    }

const POPUP_EDITOR_MIN_H = 120
const POPUP_MIN_W = 320
const POPUP_MAX_W = 800
const POPUP_MIN_H = 260
const POPUP_MAX_H = 720
/** ~1,6× frühere 360px – Toolbar in einer Zeile. */
const POPUP_DEFAULT_W = 576
const POPUP_DEFAULT_H = 380
/** Header, Anhänge-Zeile, Hinweis, Fußzeile, Padding, Griff. */
const POPUP_CHROME_H = 152

/** Über Modul-Spalten, Glass-Panels und Kontextmenüs; unter App-Modals (z-[300]). */
const NOTE_POPUP_Z = 400

type PopupFrame = { x: number; y: number; w: number; h: number }

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function frameFromAnchor(anchor: HTMLElement, align: 'left' | 'right' = 'left'): PopupFrame {
  const r = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = clamp(POPUP_DEFAULT_W, POPUP_MIN_W, Math.min(POPUP_MAX_W, vw - 32))
  const h = clamp(POPUP_DEFAULT_H, POPUP_MIN_H, Math.min(POPUP_MAX_H, vh - 32))
  let x = align === 'right' ? r.right - w : r.left
  let y = r.bottom + 8
  if (x + w > vw - 16) x = vw - 16 - w
  if (x < 16) x = 16
  if (y + h > vh - 16) y = Math.max(16, vh - 16 - h)
  if (y < 16) y = 16
  return { x, y, w, h }
}

function clampFrame(frame: PopupFrame): PopupFrame {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = clamp(frame.w, POPUP_MIN_W, Math.min(POPUP_MAX_W, vw - 32))
  const h = clamp(frame.h, POPUP_MIN_H, Math.min(POPUP_MAX_H, vh - 32))
  const x = clamp(frame.x, 8, Math.max(8, vw - w - 8))
  const y = clamp(frame.y, 8, Math.max(8, vh - h - 8))
  return { x, y, w, h }
}

interface Props {
  target: ObjectNoteTarget
  variant?: 'button' | 'section' | 'panel'
  /** Nur bei `variant="section"`: Bereich zunächst eingeklappt; Chevron zum Aufklappen. */
  sectionCollapsedDefault?: boolean
  layout?: MarkdownNoteEditorLayout
  className?: string
  /** Ausrichtung des Pop-ups relativ zum Button (nur `variant="button"`). */
  anchorAlign?: 'left' | 'right'
}

interface DialogProps {
  target: ObjectNoteTarget | null
  onClose: () => void
}

function targetKey(target: ObjectNoteTarget): string {
  if (target.kind === 'mail') return `mail:${target.messageId}`
  if (target.kind === 'people_contact') return `contact:${target.contactId}`
  return [
    'calendar',
    target.accountId,
    target.calendarSource,
    target.calendarRemoteId,
    target.eventRemoteId
  ].join(':')
}

type NotesPeopleContactApi = {
  getPeopleContact?: (contactId: number) => Promise<UserNote | null>
  upsertPeopleContact?: (input: UserNotePeopleContactUpsertInput) => Promise<UserNote>
}

type MailClientWithInvoke = typeof window.mailClient & {
  invoke?: (channel: string, payload?: unknown) => Promise<unknown>
}

async function getPeopleContactNote(contactId: number): Promise<UserNote | null> {
  const notes = window.mailClient.notes as typeof window.mailClient.notes & NotesPeopleContactApi
  if (typeof notes.getPeopleContact === 'function') {
    return notes.getPeopleContact(contactId)
  }
  const root = window.mailClient as MailClientWithInvoke
  if (typeof root.invoke === 'function') {
    return (await root.invoke(IPC.notes.getPeopleContact, contactId)) as UserNote | null
  }
  throw new Error(
    'Kontakt-Notizen sind nicht verfügbar. Bitte die Anwendung einmal vollständig neu starten.'
  )
}

async function upsertPeopleContactNote(input: UserNotePeopleContactUpsertInput): Promise<UserNote> {
  const notes = window.mailClient.notes as typeof window.mailClient.notes & NotesPeopleContactApi
  if (typeof notes.upsertPeopleContact === 'function') {
    return notes.upsertPeopleContact(input)
  }
  const root = window.mailClient as MailClientWithInvoke
  if (typeof root.invoke === 'function') {
    return (await root.invoke(IPC.notes.upsertPeopleContact, input)) as UserNote
  }
  throw new Error(
    'Kontakt-Notizen sind nicht verfügbar. Bitte die Anwendung einmal vollständig neu starten.'
  )
}

async function loadNoteForTarget(target: ObjectNoteTarget): Promise<UserNote | null> {
  if (target.kind === 'mail') return window.mailClient.notes.getMail(target.messageId)
  if (target.kind === 'people_contact') {
    return getPeopleContactNote(target.contactId)
  }
  return window.mailClient.notes.getCalendar({
    accountId: target.accountId,
    calendarSource: target.calendarSource,
    calendarRemoteId: target.calendarRemoteId,
    eventRemoteId: target.eventRemoteId
  })
}

async function saveNoteForTarget(
  target: ObjectNoteTarget,
  body: string
): Promise<UserNote> {
  if (target.kind === 'mail') {
    return window.mailClient.notes.upsertMail({
      messageId: target.messageId,
      title: target.title ?? null,
      body
    })
  }
  if (target.kind === 'people_contact') {
    return upsertPeopleContactNote({
      contactId: target.contactId,
      title: target.title ?? null,
      body
    })
  }
  return window.mailClient.notes.upsertCalendar({
    accountId: target.accountId,
    calendarSource: target.calendarSource,
    calendarRemoteId: target.calendarRemoteId,
    eventRemoteId: target.eventRemoteId,
    title: target.title ?? null,
    body,
    eventTitleSnapshot: target.eventTitleSnapshot ?? target.title ?? null,
    eventStartIsoSnapshot: target.eventStartIsoSnapshot ?? null
  })
}

function formatUpdatedAt(value: string | null, locale: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale.startsWith('de') ? 'de-DE' : 'en-GB')
}

export function ObjectNoteEditor({
  target,
  variant = 'button',
  sectionCollapsedDefault = false,
  layout = 'live',
  className,
  anchorAlign = 'left'
}: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const pushToast = useUndoStore((s) => s.pushToast)
  const [open, setOpen] = useState(variant === 'section')
  const [sectionExpanded, setSectionExpanded] = useState(() => !sectionCollapsedDefault)
  const [note, setNote] = useState<UserNote | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [popupFrame, setPopupFrame] = useState<PopupFrame>({
    x: 16,
    y: 16,
    w: POPUP_DEFAULT_W,
    h: POPUP_DEFAULT_H
  })
  const lastSavedBody = useRef('')
  const anchorRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const popupFrameRef = useRef(popupFrame)
  const popupUserPlacedRef = useRef(false)
  const prevPopupOpenRef = useRef(false)
  const moveDragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const resizeDragRef = useRef<{
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)
  popupFrameRef.current = popupFrame
  const key = useMemo(() => targetKey(target), [target])
  const isPopupVariant = variant === 'button' || variant === 'panel'
  const usePopupPortal = variant === 'button'
  const markdownHeight = Math.max(
    POPUP_EDITOR_MIN_H,
    popupFrame.h - POPUP_CHROME_H
  )

  useLayoutEffect(() => {
    if (open && isPopupVariant && !prevPopupOpenRef.current) {
      if (usePopupPortal && anchorRef.current) {
        setPopupFrame(frameFromAnchor(anchorRef.current, anchorAlign))
      } else {
        setPopupFrame((f) =>
          clampFrame({ ...f, w: POPUP_DEFAULT_W, h: POPUP_DEFAULT_H, x: f.x, y: f.y })
        )
      }
      popupUserPlacedRef.current = false
    }
    if (!open) {
      popupUserPlacedRef.current = false
    }
    prevPopupOpenRef.current = open && isPopupVariant
  }, [open, isPopupVariant, usePopupPortal, key, anchorAlign])

  useEffect(() => {
    if (!open || !isPopupVariant) return
    const onWindowResize = (): void => setPopupFrame((f) => clampFrame(f))
    window.addEventListener('resize', onWindowResize)
    return (): void => window.removeEventListener('resize', onWindowResize)
  }, [open, isPopupVariant])

  useEffect(() => {
    popupUserPlacedRef.current = false
    prevPopupOpenRef.current = false
  }, [key])

  useEffect(() => {
    if (!open || !usePopupPortal) return
    function onDocMouseDown(e: MouseEvent): void {
      if (moveDragRef.current || resizeDragRef.current) return
      const node = e.target as Node
      if (anchorRef.current?.contains(node)) return
      if (popupRef.current?.contains(node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, usePopupPortal])

  const endMove = useCallback((): void => {
    moveDragRef.current = null
    window.removeEventListener('pointermove', onMovePointerMove)
    window.removeEventListener('pointerup', endMove)
    window.removeEventListener('pointercancel', endMove)
  }, [])

  const onMovePointerMove = useCallback((e: PointerEvent): void => {
    const d = moveDragRef.current
    if (!d) return
    popupUserPlacedRef.current = true
    const { w, h } = popupFrameRef.current
    const nx = clamp(d.originX + (e.clientX - d.startX), 8, window.innerWidth - w - 8)
    const ny = clamp(d.originY + (e.clientY - d.startY), 8, window.innerHeight - h - 8)
    setPopupFrame((f) => clampFrame({ ...f, x: nx, y: ny }))
  }, [])

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (!usePopupPortal || e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      if (resizeDragRef.current) return
      moveDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: popupFrameRef.current.x,
        originY: popupFrameRef.current.y
      }
      window.addEventListener('pointermove', onMovePointerMove)
      window.addEventListener('pointerup', endMove)
      window.addEventListener('pointercancel', endMove)
    },
    [usePopupPortal, onMovePointerMove, endMove]
  )

  const onResizePointerMove = useCallback((e: PointerEvent): void => {
    const d = resizeDragRef.current
    if (!d) return
    popupUserPlacedRef.current = true
    const { x, y } = popupFrameRef.current
    const nw = d.startW + (e.clientX - d.startX)
    const nh = d.startH + (e.clientY - d.startY)
    setPopupFrame(clampFrame({ x, y, w: nw, h: nh }))
  }, [])

  const endResize = useCallback((): void => {
    resizeDragRef.current = null
    window.removeEventListener('pointermove', onResizePointerMove)
    window.removeEventListener('pointerup', endResize)
    window.removeEventListener('pointercancel', endResize)
  }, [onResizePointerMove])

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      if (moveDragRef.current) return
      resizeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: popupFrameRef.current.w,
        startH: popupFrameRef.current.h
      }
      window.addEventListener('pointermove', onResizePointerMove)
      window.addEventListener('pointerup', endResize)
      window.addEventListener('pointercancel', endResize)
    },
    [onResizePointerMove, endResize]
  )

  useEffect(() => {
    return (): void => {
      window.removeEventListener('pointermove', onMovePointerMove)
      window.removeEventListener('pointerup', endMove)
      window.removeEventListener('pointercancel', endMove)
      window.removeEventListener('pointermove', onResizePointerMove)
      window.removeEventListener('pointerup', endResize)
      window.removeEventListener('pointercancel', endResize)
    }
  }, [onMovePointerMove, endMove, onResizePointerMove, endResize])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDirty(false)
    void loadNoteForTarget(target)
      .then((loaded) => {
        if (cancelled) return
        setNote(loaded)
        const nextBody = loaded?.body ?? ''
        setBody(nextBody)
        lastSavedBody.current = nextBody
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return (): void => {
      cancelled = true
    }
    // `key` captures the target identity; the parent often creates target objects inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (variant !== 'section' || !sectionCollapsedDefault) return
    setSectionExpanded(false)
  }, [key, variant, sectionCollapsedDefault])

  useEffect(() => {
    if (!dirty || body === lastSavedBody.current) return
    const handle = window.setTimeout(() => {
      void save(false)
    }, 800)
    return (): void => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, dirty, key])

  useEffect(() => {
    const off = window.mailClient.events.onNotesChanged((payload) => {
      if (target.kind === 'mail' && payload.messageId != null && payload.messageId !== target.messageId) {
        return
      }
      if (target.kind === 'calendar' && payload.kind && payload.kind !== 'calendar') return
      if (target.kind === 'people_contact' && payload.kind === 'mail') return
      if (dirty) return
      void reload()
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dirty])

  async function reload(): Promise<void> {
    try {
      const loaded = await loadNoteForTarget(target)
      setNote(loaded)
      const nextBody = loaded?.body ?? ''
      setBody(nextBody)
      lastSavedBody.current = nextBody
      setDirty(false)
    } catch {
      // Der normale Lade-Effect zeigt Fehler; Broadcast-Reloads bleiben still.
    }
  }

  async function save(showToast: boolean): Promise<void> {
    if (saving || body === lastSavedBody.current) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveNoteForTarget(target, body)
      setNote(saved)
      lastSavedBody.current = saved.body
      setBody(saved.body)
      setDirty(false)
      if (showToast) {
        pushToast({ label: t('notes.editor.saved'), variant: 'success' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      if (showToast) {
        pushToast({ label: t('notes.editor.saveFailed'), variant: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  const hasContent = body.trim().length > 0
  const updatedLabel = formatUpdatedAt(note?.updatedAt ?? null, i18n.language)

  const hideSectionStickyTitle = variant === 'section' && sectionCollapsedDefault

  const popupPortalStyle: CSSProperties | undefined =
    usePopupPortal && open
      ? {
          position: 'fixed',
          left: popupFrame.x,
          top: popupFrame.y,
          width: popupFrame.w,
          height: popupFrame.h,
          zIndex: NOTE_POPUP_Z
        }
      : undefined

  const panelPopupStyle: CSSProperties | undefined =
    variant === 'panel' ? { height: popupFrame.h, position: 'relative' } : undefined

  const editor = (
    <div
      ref={usePopupPortal ? popupRef : undefined}
      style={popupPortalStyle ?? panelPopupStyle}
      className={cn(
        'rounded-lg border border-border bg-card shadow-lg',
        isPopupVariant && 'relative flex flex-col overflow-hidden',
        variant === 'panel' || variant === 'section' ? 'shadow-none' : 'p-3',
        className
      )}
    >
      {!hideSectionStickyTitle && variant !== 'panel' ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2',
            usePopupPortal && 'cursor-grab touch-none active:cursor-grabbing'
          )}
          onPointerDown={onHeaderPointerDown}
          aria-label={usePopupPortal ? t('notes.editor.moveAria') : undefined}
        >
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
            {usePopupPortal ? (
              <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            <StickyNote className={cn('h-4 w-4 shrink-0', hasContent && 'fill-amber-300 text-amber-500')} />
            <span className="truncate">{t('notes.editor.title')}</span>
          </div>
          {variant === 'button' ? (
            <button
              type="button"
              onClick={(): void => setOpen(false)}
              onPointerDown={(e): void => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t('common.close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          isPopupVariant ? 'px-3 pb-3 pt-2' : ''
        )}
      >
      {note?.id ? (
        <NotesAttachmentsPanel noteId={note.id} className="mb-2 shrink-0" />
      ) : !loading ? (
        <p className="mb-2 shrink-0 text-[11px] text-muted-foreground">{t('notes.attachments.requiresSavedNote')}</p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
      <MarkdownNoteEditorLazy
        value={body}
        onChange={(nextBody): void => {
          setBody(nextBody)
          setDirty(true)
        }}
        disabled={loading}
        height={isPopupVariant ? markdownHeight : 180}
        layout={layout}
        preview={isPopupVariant ? 'edit' : 'live'}
        placeholder={t('notes.editor.placeholder')}
      />
      </div>
      {error ? <div className="mt-1.5 text-[11px] text-destructive">{error}</div> : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {loading
            ? t('common.loading')
            : updatedLabel
              ? t('notes.editor.updatedAt', { date: updatedLabel })
              : t('notes.editor.notSaved')}
        </span>
        <button
          type="button"
          disabled={saving || loading || body === lastSavedBody.current}
          onClick={(): void => void save(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saving ? t('notes.editor.saving') : t('common.save')}
        </button>
      </div>
      </div>
      {isPopupVariant ? (
        <div
          aria-label={t('notes.editor.resizeAria')}
          onPointerDown={onResizePointerDown}
          className={cn(
            'absolute bottom-0 right-0 z-[2] h-5 w-5 cursor-nwse-resize rounded-br-lg',
            'hover:bg-secondary/60'
          )}
        >
          <span
            className="pointer-events-none absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-muted-foreground/70"
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  )

  if (variant === 'panel') {
    return editor
  }

  if (variant === 'section') {
    if (!sectionCollapsedDefault) return editor
    return (
      <div className={cn('space-y-2', className)}>
        <button
          type="button"
          onClick={(): void => setSectionExpanded((v) => !v)}
          aria-expanded={sectionExpanded}
          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/40"
        >
          {sectionExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <StickyNote className={cn('h-4 w-4 shrink-0', hasContent && 'fill-amber-300 text-amber-500')} aria-hidden />
          <span className="min-w-0 flex-1">{t('notes.editor.title')}</span>
        </button>
        {sectionExpanded ? editor : null}
      </div>
    )
  }

  const portaledEditor =
    open && usePopupPortal ? createPortal(editor, document.body) : null

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={(): void => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors',
          hasContent
            ? 'border-amber-400/40 bg-amber-400/10 text-foreground hover:bg-amber-400/15'
            : 'border-dashed border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        )}
        title={t('notes.editor.open')}
      >
        <StickyNote className={cn('h-3 w-3', hasContent && 'fill-amber-300 text-amber-500')} />
        {t('notes.editor.shortLabel')}
      </button>
      {portaledEditor ?? (open && !usePopupPortal ? editor : null)}
    </div>
  )
}

/** Schreibgeschützte Markdown-Vorschau einer Mail- oder Kalender-Notiz (lädt wie `ObjectNoteEditor`). */
export function ObjectNotePreview(props: {
  target: ObjectNoteTarget
  className?: string
  /** Höhe des Markdown-Viewers (Pixel). */
  previewHeight?: number
}): JSX.Element | null {
  const { target, className, previewHeight = 200 } = props
  const { t, i18n } = useTranslation()
  const [note, setNote] = useState<UserNote | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = useMemo(() => targetKey(target), [target])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadNoteForTarget(target)
      .then((loaded) => {
        if (cancelled) return
        setNote(loaded)
        setBody(loaded?.body ?? '')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const off = window.mailClient.events.onNotesChanged((payload) => {
      if (target.kind === 'mail' && payload.messageId !== target.messageId) return
      if (target.kind === 'calendar' && payload.kind && payload.kind !== 'calendar') return
      if (target.kind === 'people_contact' && payload.kind === 'mail') return
      void (async (): Promise<void> => {
        try {
          const loaded = await loadNoteForTarget(target)
          setNote(loaded)
          setBody(loaded?.body ?? '')
        } catch {
          // stiller Refresh
        }
      })()
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const updatedLabel = formatUpdatedAt(note?.updatedAt ?? null, i18n.language)

  if (loading) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border bg-secondary/10 px-4 py-2 text-[11px] text-muted-foreground',
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        {t('notes.preview.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'shrink-0 border-b border-border bg-destructive/5 px-4 py-2 text-[11px] text-destructive',
          className
        )}
        role="status"
      >
        {error}
      </div>
    )
  }

  if (!body.trim()) return null

  return (
    <div
      className={cn(
        'shrink-0 space-y-2 border-b border-border bg-secondary/10 px-4 py-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-500" aria-hidden />
          {t('notes.editor.title')}
        </div>
        {updatedLabel ? (
          <span className="text-[10px] text-muted-foreground">
            {t('notes.editor.updatedAt', { date: updatedLabel })}
          </span>
        ) : null}
      </div>
      <div className="max-h-[min(40vh,360px)] overflow-y-auto rounded-md border border-border/80 bg-background">
        <MarkdownNoteEditorLazy
          value={body}
          onChange={(): void => undefined}
          disabled
          preview="preview"
          layout="live"
          height={previewHeight}
          placeholder=""
        />
      </div>
    </div>
  )
}

export function ObjectNoteDialog({ target, onClose }: DialogProps): JSX.Element | null {
  const { t } = useTranslation()

  useEffect(() => {
    if (!target) return undefined
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onClose, target])

  if (!target) return null

  return (
    <div
      className="fixed inset-0 z-[350] flex items-start justify-center bg-black/45 p-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={(e): void => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('notes.editor.open')}
        className="w-[min(576px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <StickyNote className="h-4 w-4 text-amber-500" />
            {t('notes.editor.title')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <ObjectNoteEditor
          target={target}
          variant="panel"
          layout="toggle"
          className="rounded-none border-0 shadow-none"
        />
      </div>
    </div>
  )
}
