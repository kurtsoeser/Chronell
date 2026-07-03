import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { ComposeImage } from '@/components/tiptap-compose-image'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-text-style/font-family'
import { FontSize } from '@tiptap/extension-text-style/font-size'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
import { NoteCloudTaskItem, NoteCloudTaskList } from '@/components/tiptap-note-cloud-task-item'
import { createNoteCloudTaskDomEventHandlers } from '@/lib/note-cloud-task-dom-handlers'
import { TableRow } from '@tiptap/extension-table/row'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { prepareComposeEditorHtml, prepareNoteEditorHtml } from '@/lib/sanitize-compose-html'
import { safeTiptapGetHtml } from '@/lib/tiptap-editor-html'
import { MailTable, MailTableCell, MailTableHeader } from '@/components/tiptap-mail-table'
import { ComposeTextSnippetsMenu } from '@/components/ComposeTextSnippetsMenu'
import { TableContextToolbar } from '@/components/tiptap/TableContextToolbar'
import { TableInsertMenu } from '@/components/tiptap/TableInsertMenu'
import { TableCellHighlight } from '@/components/tiptap/tiptap-table-cell-highlight'
import { MailResizableTableView } from '@/components/tiptap/mail-resizable-table-view'
import { TIPTAP_HIGHLIGHT_COLORS } from '@/components/tiptap/tiptap-editor-colors'
import { createNoteWikiLinkExtension } from '@/components/tiptap-note-wiki-link'
import { createNoteEntityMentionExtension } from '@/components/tiptap-note-entity-mention'
import { NOTE_EMBED_TIPTAP_EXTENSIONS } from '@/components/note-embed-tiptap-extensions'
import { isNoteWikiLinkHref, parseNoteWikiLinkHref } from '@shared/note-wiki-link'
import { isNoteEntityMentionHref } from '@shared/note-entity-mention-link'
import { isEmbeddableNoteUrl } from '@shared/note-embed-registry'
import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import { showAppPrompt } from '@/stores/app-dialog'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  CalendarDays,
  Cloud,
  Paperclip,
  Link as LinkIcon,
  Link2Off,
  List,
  ListChecks,
  SquareCheckBig,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { createTipTapLinkDomEventHandlers } from '@/lib/tiptap-editor-link-click'
import { createNoteInkDomEventHandlers } from '@/lib/note-ink-dom-handlers'
import { COMPOSE_FONT_FAMILIES } from '@/lib/compose-font-families'
import { ensureComposeBundledFontLoaded } from '@/lib/compose-font-loader'
import { COMPOSE_FONT_SIZES_PT, composeFontSizePtOptionValue } from '@/lib/compose-font-sizes'
import {
  applyComposeDefaultTypingMarks,
  composeEditorSurfaceStyle,
  isComposeBodyEffectivelyEmpty
} from '@/lib/compose-default-body'
import { useComposeSettingsPrefs } from '@/lib/use-compose-settings-prefs'
import {
  composeEditorScalePercent,
  useComposeEditorScaleStore
} from '@/stores/compose-editor-scale'
import { useComposeEditorEffectiveTheme } from '@/stores/compose-editor-theme'
import { useTranslation } from 'react-i18next'

const TIPTAP_CONTENT_CLASS = cn(
  'chronell-tiptap-content max-w-none px-4 py-3 leading-relaxed text-foreground focus:outline-none'
)

const TIPTAP_CONTENT_BLOCK_CLASS = cn(
  '[&_ul:not([data-type=taskList])]:list-disc [&_ul:not([data-type=taskList])]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_a]:underline',
  '[&_img]:rounded [&_img]:my-2 [&_hr]:my-3 [&_hr]:border-border',
  '[&_table_td>p]:mb-0 [&_table_td>p]:mt-0 [&_table_th>p]:mb-0 [&_table_th>p]:mt-0'
)

/** Überschrift anwenden und Compose-Standard-Schriftgröße entfernen (sonst zu klein). */
function applyTiptapHeading(editor: Editor, level: 1 | 2 | 3): void {
  editor
    .chain()
    .focus()
    .toggleHeading({ level })
    .updateAttributes('textStyle', { fontSize: null })
    .run()
}

interface Props {
  valueHtml: string
  onChangeHtml: (html: string) => void
  autoFocus?: boolean
  className?: string
  /** Platzhalter im leeren Editor (Standard: Nachricht schreiben…). */
  placeholder?: string
  /**
   * Optional: wird aufgerufen, wenn der Nutzer Bilder ueber den Toolbar-Button
   * einfuegt. Wird nichts uebergeben, wird intern ein <input type=file> verwendet
   * und das Bild als Daten-URL inline eingefuegt.
   */
  onPickImages?: () => Promise<Array<{ src: string; alt?: string }>>
  /** Dateien als E-Mail-Anhang (Toolbar-Büroklammer). */
  onAttachFiles?: (files: File[]) => void
  /** Badge auf der Büroklammer (lokale Anhänge). */
  attachmentCount?: number
  /** OneDrive / SharePoint (Microsoft 365). */
  onCloudAttach?: () => void
  /** Badge auf dem Cloud-Button (Reference-Anhänge). */
  cloudAttachmentCount?: number
  /** Kompakter Editor (z.B. Signatur). */
  variant?: 'default' | 'compact'
  /**
   * Mindesthoehe des Editor-Inhalts.
   * Standard: `min-h-[220px]` (default), `min-h-[7.5rem]` (compact).
   */
  editorMinHeightClass?: string
  /** Wenn false: kein Flex-Grow (z.B. feste Signatur-Zeile). Standard: true. */
  fillHeight?: boolean
  /** Toolbar/Rahmen an die dunklere Compose-Flaeche anpassen. */
  inEditorSurface?: boolean
  /** Optional: aktuellen HTML-Inhalt in den Store schreiben (vor Speichern / Unmount). */
  flushRef?: MutableRefObject<(() => void) | null>
  /** Optional: HTML an der Cursor-Position einfügen (z. B. Besprechungsdetails). */
  insertHtmlRef?: MutableRefObject<((html: string) => void) | null>
  /** Optional: Freihand-Vorschaubild anhand der JSON-Anhang-ID ersetzen. */
  replaceInkSnapshotRef?: MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
  /** Doppelklick auf eingebettete Freihand-Bilder (Re-Edit). */
  onInkImageDoubleClick?: (inkJsonAttachmentId: number) => void
  /** Checklisten in der Toolbar (Notizen-Editor). */
  enableTaskList?: boolean
  /** Auswahl als Cloud-Aufgabe anlegen (Notizen). */
  onCreateCloudTask?: () => void
  /** Checkbox einer verknüpften Cloud-Aufgabe umschalten. */
  onCloudTaskToggle?: (ref: NoteCloudTaskRef, completed: boolean) => void | Promise<void>
  /** Editor-Instanz für übergeordnete Hooks bereitstellen. */
  editorRef?: MutableRefObject<Editor | null>
  /** `[[` — interne Notiz-Verknüpfungen mit Autocomplete. */
  noteWikiLinks?: {
    currentNoteId?: number
    onOpenNote: (noteId: number) => void
    onLinkAdded?: () => void
    onLinkError?: (message: string) => void
  }
  /** `@` — Kontakte und Kalendertermine verknüpfen. */
  noteEntityMentions?: {
    noteId?: number
    onOpenEntity: (target: NoteEntityLinkTarget) => void
    onLinkAdded?: () => void
    onLinkError?: (message: string) => void
  }
  /** Auswahl als Termin anlegen (Notizen). */
  onCreateCalendarEvent?: () => void
  /** Zeile über der Toolbar (z. B. Notizen-Aktionen). */
  editorActionBar?: ReactNode
  /** Aktionszeile + Toolbar beim Scrollen der Seite oben fixieren. */
  stickyEditorChrome?: boolean
  /** Nur der Editor-Inhalt scrollt; Chrome bleibt im fixen Seitenkopf. */
  scrollEditorBodyOnly?: boolean
  /** Inhalt unter dem Editor-Text, innerhalb des Scroll-Bereichs. */
  scrollFooter?: ReactNode
}

const TEXT_COLORS: Array<{ value: string; label: string }> = [
  { value: '#0f172a', label: 'Standard' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Gelb' },
  { value: '#22c55e', label: 'Grün' },
  { value: '#06b6d4', label: 'Türkis' },
  { value: '#3b82f6', label: 'Blau' },
  { value: '#a855f7', label: 'Violett' },
  { value: '#64748b', label: 'Grau' }
]

const HIGHLIGHT_COLORS = TIPTAP_HIGHLIGHT_COLORS

export function TipTapBody({
  valueHtml,
  onChangeHtml,
  autoFocus,
  className,
  placeholder,
  variant = 'default',
  editorMinHeightClass,
  fillHeight = true,
  onPickImages,
  onAttachFiles,
  attachmentCount = 0,
  onCloudAttach,
  cloudAttachmentCount = 0,
  inEditorSurface = false,
  flushRef,
  insertHtmlRef,
  replaceInkSnapshotRef,
  onInkImageDoubleClick,
  enableTaskList = false,
  onCreateCloudTask,
  onCloudTaskToggle,
  editorRef,
  noteWikiLinks,
  noteEntityMentions,
  onCreateCalendarEvent,
  editorActionBar,
  stickyEditorChrome = false,
  scrollEditorBodyOnly = false,
  scrollFooter
}: Props): JSX.Element {
  const { t } = useTranslation()
  const contentMinHeight =
    editorMinHeightClass ??
    (variant === 'compact' ? 'min-h-[7.5rem]' : 'min-h-[220px]')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState<'text' | 'highlight' | null>(null)
  const composeScale = useComposeEditorScaleStore((s) => s.scale)
  const composeEditorTheme = useComposeEditorEffectiveTheme()
  const composePrefs = useComposeSettingsPrefs()
  const lastEmittedHtmlRef = useRef<string | null>(null)
  const initialEditorHtmlRef = useRef<string | null>(null)
  const prepareEditorHtml = enableTaskList ? prepareNoteEditorHtml : prepareComposeEditorHtml
  if (initialEditorHtmlRef.current === null) {
    initialEditorHtmlRef.current = prepareEditorHtml(valueHtml) || '<p></p>'
  }
  const wikiLinkCurrentNoteId = noteWikiLinks?.currentNoteId
  const enableWikiLinks = noteWikiLinks != null
  const enableEntityMentions = noteEntityMentions != null
  const editorSurfaceStyle = useMemo(
    () => (inEditorSurface ? composeEditorSurfaceStyle(composePrefs, composeEditorTheme) : null),
    [composePrefs, composeEditorTheme, inEditorSurface]
  )

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        heading: { levels: [1, 2, 3] }
      }),
      Link.configure({
        openOnClick: false,
        autolink: !enableWikiLinks,
        linkOnPaste: true,
        shouldAutoLink: (url) =>
          !isNoteWikiLinkHref(url) &&
          !isNoteEntityMentionHref(url) &&
          !isEmbeddableNoteUrl(url),
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Nachricht schreiben…' }),
      ComposeImage,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize.configure({ types: ['textStyle'] }),
      Color,
      Highlight.configure({ multicolor: true }),
      MailTable.configure({
        resizable: true,
        renderWrapper: false,
        cellMinWidth: 48,
        handleWidth: 6,
        lastColumnResizable: true,
        View: MailResizableTableView
      }),
      TableRow,
      MailTableHeader,
      MailTableCell,
      TableCellHighlight,
      ...(enableTaskList
        ? [NoteCloudTaskList, NoteCloudTaskItem, ...NOTE_EMBED_TIPTAP_EXTENSIONS]
        : []),
      ...(enableWikiLinks
        ? [
            createNoteWikiLinkExtension({
              currentNoteId: wikiLinkCurrentNoteId,
              onLinkAdded: noteWikiLinks?.onLinkAdded,
              onLinkError: noteWikiLinks?.onLinkError
            })
          ]
        : []),
      ...(enableEntityMentions
        ? [
            createNoteEntityMentionExtension({
              noteId: noteEntityMentions?.noteId,
              onLinkAdded: noteEntityMentions?.onLinkAdded,
              onLinkError: noteEntityMentions?.onLinkError
            })
          ]
        : [])
    ],
    [placeholder, enableTaskList, enableWikiLinks, enableEntityMentions, wikiLinkCurrentNoteId, noteWikiLinks, noteEntityMentions]
  )

  const onOpenNoteRef = useRef(noteWikiLinks?.onOpenNote)
  onOpenNoteRef.current = noteWikiLinks?.onOpenNote
  const onInkImageDoubleClickRef = useRef(onInkImageDoubleClick)
  onInkImageDoubleClickRef.current = onInkImageDoubleClick

  const onOpenEntityRef = useRef(noteEntityMentions?.onOpenEntity)
  onOpenEntityRef.current = noteEntityMentions?.onOpenEntity

  const linkDomEventHandlers = useMemo(
    () =>
      createTipTapLinkDomEventHandlers(() => ({
        onOpenNote: onOpenNoteRef.current,
        onOpenEntityMention: onOpenEntityRef.current
      })),
    []
  )

  const inkDomEventHandlers = useMemo(
    () => createNoteInkDomEventHandlers(() => onInkImageDoubleClickRef.current),
    []
  )

  const onCloudTaskToggleRef = useRef(onCloudTaskToggle)
  onCloudTaskToggleRef.current = onCloudTaskToggle

  const cloudTaskDomEventHandlers = useMemo(
    () =>
      createNoteCloudTaskDomEventHandlers(() => {
        const handler = onCloudTaskToggleRef.current
        if (!handler) return undefined
        return (ref, completed): void => {
          if (!ref) return
          void handler(ref, completed)
        }
      }),
    []
  )

  const domEventHandlers = useMemo(
    () => ({
      ...linkDomEventHandlers,
      ...(onInkImageDoubleClick ? inkDomEventHandlers : {}),
      ...(onCloudTaskToggle ? cloudTaskDomEventHandlers : {})
    }),
    [cloudTaskDomEventHandlers, inkDomEventHandlers, linkDomEventHandlers, onCloudTaskToggle, onInkImageDoubleClick]
  )

  const editor = useEditor({
    extensions,
    content: initialEditorHtmlRef.current,
    onCreate({ editor: ed }): void {
      const html = safeTiptapGetHtml(ed)
      if (html !== null) lastEmittedHtmlRef.current = html
      if (inEditorSurface) applyComposeDefaultTypingMarks(ed, composePrefs, composeEditorTheme)
    },
    editorProps: {
      attributes: {
        class: cn(
          TIPTAP_CONTENT_CLASS,
          !inEditorSurface && 'text-sm',
          contentMinHeight,
          TIPTAP_CONTENT_BLOCK_CLASS,
          !inEditorSurface && '[&_a]:text-primary'
        ),
        ...(editorSurfaceStyle
          ? {
              style: `font-family:${editorSurfaceStyle.fontFamily};font-size:${editorSurfaceStyle.fontSize};color:${editorSurfaceStyle.color};line-height:${editorSurfaceStyle.lineHeight}`
            }
          : {})
      },
      handleDOMEvents: domEventHandlers
    },
    onUpdate({ editor: ed }): void {
      const html = safeTiptapGetHtml(ed)
      if (html !== null) {
        lastEmittedHtmlRef.current = html
        onChangeHtml(html)
      }
    }
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed || !inEditorSurface) return
    const style = composeEditorSurfaceStyle(composePrefs, composeEditorTheme)
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        handleDOMEvents: domEventHandlers,
        attributes: {
          class: cn(
            TIPTAP_CONTENT_CLASS,
            contentMinHeight,
            TIPTAP_CONTENT_BLOCK_CLASS
          ),
          style: `font-family:${style.fontFamily};font-size:${style.fontSize};color:${style.color};line-height:${style.lineHeight}`
        }
      }
    })
    const html = safeTiptapGetHtml(editor)
    if (html !== null && isComposeBodyEffectivelyEmpty(html)) {
      applyComposeDefaultTypingMarks(editor, composePrefs, composeEditorTheme)
    }
  }, [editor, inEditorSurface, composePrefs, composeEditorTheme, contentMinHeight, linkDomEventHandlers])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (valueHtml === lastEmittedHtmlRef.current) return
    const prepared = prepareEditorHtml(valueHtml) || '<p></p>'
    const cur = safeTiptapGetHtml(editor)
    if (cur === null || cur === prepared) {
      lastEmittedHtmlRef.current = prepared
      return
    }
    editor.commands.setContent(prepared, { emitUpdate: false })
    lastEmittedHtmlRef.current = prepared
  }, [editor, valueHtml, prepareEditorHtml])

  useEffect(() => {
    if (autoFocus && editor) editor.commands.focus('end')
  }, [autoFocus, editor])

  useEffect(() => {
    if (!flushRef) return
    if (!editor || editor.isDestroyed) {
      flushRef.current = null
      return
    }
    flushRef.current = (): void => {
      const html = safeTiptapGetHtml(editor)
      if (html !== null) {
        lastEmittedHtmlRef.current = html
        onChangeHtml(html)
      }
    }
    return (): void => {
      flushRef.current = null
    }
  }, [editor, flushRef, onChangeHtml])

  useEffect(() => {
    if (!insertHtmlRef) return
    if (!editor || editor.isDestroyed) {
      insertHtmlRef.current = null
      return
    }
    insertHtmlRef.current = (html: string): void => {
      editor.chain().focus().insertContent(html).run()
      const out = safeTiptapGetHtml(editor)
      if (out !== null) {
        lastEmittedHtmlRef.current = out
        onChangeHtml(out)
      }
    }
    return (): void => {
      insertHtmlRef.current = null
    }
  }, [editor, insertHtmlRef, onChangeHtml])

  useEffect(() => {
    if (!replaceInkSnapshotRef) return
    if (!editor || editor.isDestroyed) {
      replaceInkSnapshotRef.current = null
      return
    }
    replaceInkSnapshotRef.current = (inkJsonAttachmentId: number, html: string): void => {
      let replaceFrom: number | null = null
      let replaceTo: number | null = null
      editor.state.doc.descendants((node, pos) => {
        if (replaceFrom != null) return false
        if (
          node.type.name === 'image' &&
          String(node.attrs.inkSourceAttachmentId) === String(inkJsonAttachmentId)
        ) {
          replaceFrom = pos
          replaceTo = pos + node.nodeSize
          return false
        }
        return undefined
      })
      if (replaceFrom == null || replaceTo == null) {
        editor.chain().focus().insertContent(html).run()
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: replaceFrom, to: replaceTo })
          .insertContentAt(replaceFrom, html)
          .run()
      }
      const out = safeTiptapGetHtml(editor)
      if (out !== null) {
        lastEmittedHtmlRef.current = out
        onChangeHtml(out)
      }
    }
    return (): void => {
      replaceInkSnapshotRef.current = null
    }
  }, [editor, onChangeHtml, replaceInkSnapshotRef])

  useEffect(() => {
    if (!editorRef) return
    if (!editor || editor.isDestroyed) {
      editorRef.current = null
      return
    }
    editorRef.current = editor
    return (): void => {
      editorRef.current = null
    }
  }, [editor, editorRef])

  const [hasTextSelection, setHasTextSelection] = useState(false)
  useEffect(() => {
    if (!editor || editor.isDestroyed || (!onCreateCloudTask && !onCreateCalendarEvent)) {
      setHasTextSelection(false)
      return
    }
    const updateSelection = (): void => {
      const { from, to, empty } = editor.state.selection
      setHasTextSelection(
        !empty && editor.state.doc.textBetween(from, to, ' ').trim().length > 0
      )
    }
    updateSelection()
    editor.on('selectionUpdate', updateSelection)
    return (): void => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor, onCreateCalendarEvent, onCreateCloudTask])

  if (!editor) {
    return (
      <div
        className={cn(
          'animate-pulse rounded bg-muted/40',
          contentMinHeight
        )}
      />
    )
  }

  const handleInsertLink = (): void => {
    void (async (): Promise<void> => {
      const prev = editor.getAttributes('link').href as string | undefined
      const url = await showAppPrompt('Link-URL eingeben:', {
        title: 'Link',
        defaultValue: prev ?? 'https://',
        placeholder: 'https://…'
      })
      if (url === null) return
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    })()
  }

  const handleRemoveLink = (): void => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  const handleAttachFiles = (): void => {
    attachmentInputRef.current?.click()
  }

  const handleAttachmentInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files?.length || !onAttachFiles) return
    onAttachFiles(Array.from(files))
    e.target.value = ''
  }

  const handleInsertImages = async (): Promise<void> => {
    if (onPickImages) {
      try {
        const imgs = await onPickImages()
        for (const img of imgs) {
          editor.chain().focus().setImage({ src: img.src, alt: img.alt }).run()
        }
      } catch (e) {
        console.warn('[tiptap] Bild einfuegen fehlgeschlagen:', e)
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    Promise.all(
      list.map(
        (f) =>
          new Promise<{ src: string; alt: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (): void => {
              resolve({ src: String(reader.result ?? ''), alt: f.name })
            }
            reader.onerror = (): void => reject(reader.error)
            reader.readAsDataURL(f)
          })
      )
    )
      .then((items) => {
        for (const it of items) {
          editor.chain().focus().setImage({ src: it.src, alt: it.alt }).run()
        }
      })
      .catch((err) => console.warn('[tiptap] Datei lesen:', err))
      .finally(() => {
        e.target.value = ''
      })
  }

  const surfaceBorder = inEditorSurface ? '' : 'border-border/40'

  const toolbar = (
    <Toolbar
      editor={editor}
      variant={variant}
      inEditorSurface={inEditorSurface}
      enableTaskList={enableTaskList}
      composeScalePercent={
        inEditorSurface ? composeEditorScalePercent(composeScale) : undefined
      }
      onLink={handleInsertLink}
      onUnlink={handleRemoveLink}
      onImage={handleInsertImages}
      onAttach={onAttachFiles ? handleAttachFiles : undefined}
      attachmentCount={attachmentCount}
      onCloudAttach={onCloudAttach}
      cloudAttachmentCount={cloudAttachmentCount}
      onCreateCloudTask={onCreateCloudTask}
      onCreateCalendarEvent={onCreateCalendarEvent}
      hasTextSelection={hasTextSelection}
      colorPickerOpen={colorPickerOpen}
      setColorPickerOpen={setColorPickerOpen}
    />
  )

  const editorChrome = scrollEditorBodyOnly ? (
    <div className="note-editor-pinned-chrome shrink-0 shadow-[0_1px_0_hsl(var(--border)/0.45)]">
      {editorActionBar}
      {toolbar}
      {editor ? <TableContextToolbar editor={editor} inEditorSurface={inEditorSurface} /> : null}
    </div>
  ) : stickyEditorChrome ? (
    <div className="note-editor-sticky-chrome sticky top-0 z-30 shrink-0 shadow-[0_1px_0_hsl(var(--border)/0.45)]">
      {editorActionBar}
      {toolbar}
      {editor ? <TableContextToolbar editor={editor} inEditorSurface={inEditorSurface} /> : null}
    </div>
  ) : (
    <>
      {editorActionBar}
      {toolbar}
      {editor ? <TableContextToolbar editor={editor} inEditorSurface={inEditorSurface} /> : null}
    </>
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        !inEditorSurface && 'border-t',
        surfaceBorder,
        fillHeight ? 'flex-1' : 'shrink-0',
        className
      )}
    >
      {editorChrome}
      <div
        className={cn(
          scrollEditorBodyOnly && 'flex min-h-0 flex-1 flex-col overflow-y-auto',
          stickyEditorChrome && !scrollEditorBodyOnly && 'overflow-visible',
          !stickyEditorChrome && !scrollEditorBodyOnly && 'min-h-0 overflow-y-auto',
          inEditorSurface && 'compose-editor-canvas',
          fillHeight && !stickyEditorChrome && !scrollEditorBodyOnly && 'flex-1',
          !fillHeight && !stickyEditorChrome && !scrollEditorBodyOnly && 'max-h-[13.5rem]'
        )}
        data-compose-theme={inEditorSurface ? composeEditorTheme : undefined}
        style={
          inEditorSurface && composeScale !== 1
            ? ({ zoom: composeScale } as CSSProperties)
            : undefined
        }
      >
        <div className={scrollEditorBodyOnly ? 'min-h-full flex flex-1 flex-col' : undefined}>
          <div className={scrollEditorBodyOnly ? 'shrink-0' : undefined}>
            <EditorContent editor={editor} />
          </div>
          {scrollFooter ? (
            <div className={scrollEditorBodyOnly ? 'mt-auto shrink-0' : undefined}>{scrollFooter}</div>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesChosen}
      />
      {onAttachFiles ? (
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleAttachmentInputChange}
        />
      ) : null}
    </div>
  )
}

function Toolbar({
  editor,
  variant,
  inEditorSurface,
  enableTaskList = false,
  composeScalePercent: composeZoomPct,
  onLink,
  onUnlink,
  onImage,
  onAttach,
  attachmentCount = 0,
  onCloudAttach,
  cloudAttachmentCount = 0,
  onCreateCloudTask,
  onCreateCalendarEvent,
  hasTextSelection = false,
  colorPickerOpen,
  setColorPickerOpen
}: {
  editor: Editor
  variant: 'default' | 'compact'
  inEditorSurface?: boolean
  enableTaskList?: boolean
  composeScalePercent?: number
  onLink: () => void
  onUnlink: () => void
  onImage: () => void
  onAttach?: () => void
  attachmentCount?: number
  onCloudAttach?: () => void
  cloudAttachmentCount?: number
  onCreateCloudTask?: () => void
  onCreateCalendarEvent?: () => void
  hasTextSelection?: boolean
  colorPickerOpen: 'text' | 'highlight' | null
  setColorPickerOpen: (v: 'text' | 'highlight' | null) => void
}): JSX.Element {
  const { t } = useTranslation()
  const toolbarChrome = inEditorSurface
    ? 'compose-editor-toolbar-zone'
    : 'border-border/50 bg-secondary/30'

  const fontSelectClass = cn(
    'rounded border px-2 py-0.5 text-2xs',
    inEditorSurface
      ? 'border-[hsl(var(--compose-surface-border)/0.5)] bg-[hsl(0_0%_14%)] text-foreground'
      : cn('bg-background', listSubtleBorderClass)
  )


  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-0.5 border-b px-2 py-1',
        toolbarChrome
      )}
    >
      {/* Block-Style */}
      <BarBtn
        active={editor.isActive('paragraph') && !editor.isActive('heading')}
        label="Absatz"
        onClick={(): void => {
          editor.chain().focus().setParagraph().run()
        }}
        icon={Pilcrow}
      />
      <BarBtn
        active={editor.isActive('heading', { level: 1 })}
        label="Überschrift 1"
        onClick={(): void => {
          applyTiptapHeading(editor, 1)
        }}
        icon={Heading1}
      />
      <BarBtn
        active={editor.isActive('heading', { level: 2 })}
        label="Überschrift 2"
        onClick={(): void => {
          applyTiptapHeading(editor, 2)
        }}
        icon={Heading2}
      />
      <BarBtn
        active={editor.isActive('heading', { level: 3 })}
        label="Überschrift 3"
        onClick={(): void => {
          applyTiptapHeading(editor, 3)
        }}
        icon={Heading3}
      />

      <Separator />

      <BarBtn
        active={editor.isActive('bold')}
        label="Fett"
        onClick={(): void => {
          editor.chain().focus().toggleBold().run()
        }}
        icon={Bold}
      />
      <BarBtn
        active={editor.isActive('italic')}
        label="Kursiv"
        onClick={(): void => {
          editor.chain().focus().toggleItalic().run()
        }}
        icon={Italic}
      />
      <BarBtn
        active={editor.isActive('underline')}
        label="Unterstrichen"
        onClick={(): void => {
          editor.chain().focus().toggleUnderline().run()
        }}
        icon={UnderlineIcon}
      />
      <BarBtn
        active={editor.isActive('strike')}
        label="Durchgestrichen"
        onClick={(): void => {
          editor.chain().focus().toggleStrike().run()
        }}
        icon={Strikethrough}
      />
      <BarBtn
        active={editor.isActive('code')}
        label="Code (inline)"
        onClick={(): void => {
          editor.chain().focus().toggleCode().run()
        }}
        icon={Code}
      />

      {variant === 'default' && (
        <>
          <Separator />
          <select
            className={cn(fontSelectClass, 'w-[184px] max-w-[184px]')}
            title="Schriftart"
            aria-label="Schriftart"
            defaultValue=""
            onChange={(e): void => {
              const id = e.target.value
              const entry = COMPOSE_FONT_FAMILIES.find((f) => f.id === id)
              if (!entry) editor.chain().focus().unsetFontFamily().run()
              else {
                void ensureComposeBundledFontLoaded(entry.fontsource)
                editor.chain().focus().setFontFamily(entry.value).run()
              }
              e.currentTarget.selectedIndex = 0
            }}
          >
            <option value="">Schrift…</option>
            {COMPOSE_FONT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className={cn(fontSelectClass, 'w-[80px]')}
            title="Schriftgröße (pt)"
            aria-label="Schriftgröße"
            defaultValue=""
            onChange={(e): void => {
              const v = e.target.value
              if (!v) editor.chain().focus().unsetFontSize().run()
              else editor.chain().focus().setFontSize(v).run()
              e.currentTarget.selectedIndex = 0
            }}
          >
            <option value="">Gr.</option>
            {COMPOSE_FONT_SIZES_PT.map((pt) => (
              <option key={pt} value={composeFontSizePtOptionValue(pt)}>
                {pt}
              </option>
            ))}
          </select>
          <ComposeTextSnippetsMenu editor={editor} />
        </>
      )}

      {variant === 'default' && composeZoomPct != null && composeZoomPct !== 100 && (
        <span
          className="tabular-nums text-2xs text-muted-foreground"
          title="Text-Zoom (Strg + Plus/Minus, Strg + 0 zurücksetzen)"
        >
          {composeZoomPct}%
        </span>
      )}

      <Separator />

      {/* Farben */}
      <ColorPicker
        kind="text"
        open={colorPickerOpen === 'text'}
        setOpen={(b): void => setColorPickerOpen(b ? 'text' : null)}
        active={Boolean(editor.getAttributes('textStyle').color)}
        onPick={(c): void => {
          editor.chain().focus().setColor(c).run()
          setColorPickerOpen(null)
        }}
        onReset={(): void => {
          editor.chain().focus().unsetColor().run()
          setColorPickerOpen(null)
        }}
      />
      <ColorPicker
        kind="highlight"
        open={colorPickerOpen === 'highlight'}
        setOpen={(b): void => setColorPickerOpen(b ? 'highlight' : null)}
        active={editor.isActive('highlight')}
        onPick={(c): void => {
          editor.chain().focus().toggleHighlight({ color: c }).run()
          setColorPickerOpen(null)
        }}
        onReset={(): void => {
          editor.chain().focus().unsetHighlight().run()
          setColorPickerOpen(null)
        }}
      />

      <Separator />

      {/* Alignment */}
      <BarBtn
        active={editor.isActive({ textAlign: 'left' })}
        label="Linksbündig"
        onClick={(): void => {
          editor.chain().focus().setTextAlign('left').run()
        }}
        icon={AlignLeft}
      />
      <BarBtn
        active={editor.isActive({ textAlign: 'center' })}
        label="Zentriert"
        onClick={(): void => {
          editor.chain().focus().setTextAlign('center').run()
        }}
        icon={AlignCenter}
      />
      <BarBtn
        active={editor.isActive({ textAlign: 'right' })}
        label="Rechtsbündig"
        onClick={(): void => {
          editor.chain().focus().setTextAlign('right').run()
        }}
        icon={AlignRight}
      />
      <BarBtn
        active={editor.isActive({ textAlign: 'justify' })}
        label="Blocksatz"
        onClick={(): void => {
          editor.chain().focus().setTextAlign('justify').run()
        }}
        icon={AlignJustify}
      />

      <Separator />

      {/* Listen + Quote + HR */}
      <BarBtn
        active={editor.isActive('bulletList')}
        label="Aufzählung"
        onClick={(): void => {
          editor.chain().focus().toggleBulletList().run()
        }}
        icon={List}
      />
      <BarBtn
        active={editor.isActive('orderedList')}
        label="Nummerierte Liste"
        onClick={(): void => {
          editor.chain().focus().toggleOrderedList().run()
        }}
        icon={ListOrdered}
      />
      {enableTaskList ? (
        <BarBtn
          active={editor.isActive('taskList')}
          label="Checkliste"
          onClick={(): void => {
            editor.chain().focus().toggleTaskList().run()
          }}
          icon={ListChecks}
        />
      ) : null}
      {onCreateCloudTask ? (
        <BarBtn
          active={false}
          disabled={!hasTextSelection}
          label={t('notes.cloudTask.fromSelection')}
          onClick={onCreateCloudTask}
          icon={SquareCheckBig}
        />
      ) : null}
      {onCreateCalendarEvent ? (
        <BarBtn
          active={false}
          disabled={!hasTextSelection}
          label={t('notes.calendarEvent.fromSelection')}
          onClick={onCreateCalendarEvent}
          icon={CalendarDays}
        />
      ) : null}
      <BarBtn
        active={editor.isActive('blockquote')}
        label="Zitat"
        onClick={(): void => {
          editor.chain().focus().toggleBlockquote().run()
        }}
        icon={Quote}
      />
      <BarBtn
        active={false}
        label="Trennlinie"
        onClick={(): void => {
          editor.chain().focus().setHorizontalRule().run()
        }}
        icon={Minus}
      />

      <TableInsertMenu editor={editor} />

      <Separator />

      <BarBtn
        active={editor.isActive('link')}
        label="Link einfügen / bearbeiten"
        onClick={onLink}
        icon={LinkIcon}
      />
      <BarBtn
        active={false}
        label="Link entfernen"
        onClick={onUnlink}
        disabled={!editor.isActive('link')}
        icon={Link2Off}
      />
      <BarBtn
        active={false}
        label="Bild einfügen"
        onClick={onImage}
        icon={ImageIcon}
      />
      {onAttach ? (
        <span className="relative inline-flex">
          <BarBtn active={false} label="Datei anhängen" onClick={onAttach} icon={Paperclip} />
          {attachmentCount > 0 ? (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold leading-none text-primary-foreground">
              {attachmentCount > 99 ? '99+' : attachmentCount}
            </span>
          ) : null}
        </span>
      ) : null}
      {onCloudAttach ? (
        <span className="relative inline-flex">
          <BarBtn
            active={false}
            label="OneDrive / SharePoint"
            onClick={onCloudAttach}
            icon={Cloud}
          />
          {cloudAttachmentCount > 0 ? (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-semibold leading-none text-white">
              {cloudAttachmentCount > 99 ? '99+' : cloudAttachmentCount}
            </span>
          ) : null}
        </span>
      ) : null}

      <Separator />

      <BarBtn
        active={false}
        label="Formatierung entfernen"
        onClick={(): void => {
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }}
        icon={Eraser}
      />

      <div className="flex-1" />

      <BarBtn
        active={false}
        label="Rückgängig"
        onClick={(): void => {
          editor.chain().focus().undo().run()
        }}
        disabled={!editor.can().undo()}
        icon={Undo2}
      />
      <BarBtn
        active={false}
        label="Wiederherstellen"
        onClick={(): void => {
          editor.chain().focus().redo().run()
        }}
        disabled={!editor.can().redo()}
        icon={Redo2}
      />
    </div>
  )
}

function Separator(): JSX.Element {
  return <span className="mx-1 h-5 w-px bg-border/60" />
}

function BarBtn({
  active,
  label,
  onClick,
  icon: Icon,
  disabled
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        active && 'bg-secondary text-foreground',
        disabled && 'opacity-40 hover:bg-transparent hover:text-muted-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function ColorPicker({
  kind,
  open,
  setOpen,
  active,
  onPick,
  onReset
}: {
  kind: 'text' | 'highlight'
  open: boolean
  setOpen: (b: boolean) => void
  active: boolean
  onPick: (color: string) => void
  onReset: () => void
}): JSX.Element {
  const palette = kind === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS
  const label = kind === 'text' ? 'Textfarbe' : 'Texthervorhebung'
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={(): void => setOpen(!open)}
        className={cn(
          'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          active && 'bg-secondary text-foreground'
        )}
      >
        <Palette className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Schliessen"
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute left-0 top-7 z-40 flex w-44 flex-col gap-1 rounded-md border border-border bg-card p-2 shadow-xl">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <div className="grid grid-cols-5 gap-1">
              {palette.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="h-5 w-5 rounded border border-border/60 hover:scale-110"
                  style={{ backgroundColor: c.value }}
                  onClick={(): void => onPick(c.value)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onReset}
              className="mt-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Zurücksetzen
            </button>
          </div>
        </>
      )}
    </div>
  )
}
