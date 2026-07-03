import { useCallback, useMemo, type MutableRefObject, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import { openNoteEntityLinkTarget } from '@/lib/note-entity-link-nav'
import { ComposeEditorSurface } from '@/components/ComposeEditorSurface'
import { ComposeEditorThemedPane } from '@/components/ComposeEditorThemedPane'
import { ComposeEditorThemeToggle } from '@/components/ComposeEditorThemeToggle'
import { NoteEditorActionBar } from '@/components/NoteEditorActionBar'
import { TipTapBody } from '@/components/TipTapBody'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { cn } from '@/lib/utils'

export interface TipTapNoteEditorProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  placeholder: string
  fillHeight?: boolean
  minHeight?: number
  variant?: 'default' | 'compact'
  className?: string
  showThemeToggle?: boolean
  /** Linke Seite der Aktionszeile über der Formatierungsleiste. */
  actionBarStart?: ReactNode
  /** Aktionszeile + Formatierungsleiste beim Scrollen fixieren (Notizen-Hauptseite). */
  stickyEditorChrome?: boolean
  /** Nur der Editor-Inhalt scrollt; Chrome bleibt im fixen Seitenkopf. */
  scrollEditorBodyOnly?: boolean
  /** Inhalt unter dem Editor-Text, innerhalb des Scroll-Bereichs. */
  scrollFooter?: ReactNode
  flushRef?: MutableRefObject<(() => void) | null>
  insertHtmlRef?: MutableRefObject<((html: string) => void) | null>
  replaceInkSnapshotRef?: MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
  onInkImageDoubleClick?: (inkJsonAttachmentId: number) => void
  currentNoteId?: number
  onOpenLinkedNote?: (noteId: number) => void
  onCreateCloudTask?: () => void
  onCreateCloudTaskFromSelection?: () => void
  onCloudTaskToggle?: (ref: NoteCloudTaskRef, completed: boolean) => void | Promise<void>
  onCreateCalendarEventFromSelection?: () => void
  onEntityMentionLinkAdded?: () => void
  onEntityMentionLinkError?: (message: string) => void
  editorRef?: MutableRefObject<Editor | null>
}

const DEFAULT_MIN_HEIGHT = 200
const COMPACT_MIN_HEIGHT = 120

export function TipTapNoteEditor({
  valueHtml,
  onChangeHtml,
  placeholder,
  fillHeight = false,
  minHeight,
  variant = 'default',
  className,
  showThemeToggle = true,
  actionBarStart,
  stickyEditorChrome = false,
  scrollEditorBodyOnly = false,
  scrollFooter,
  flushRef,
  insertHtmlRef,
  replaceInkSnapshotRef,
  onInkImageDoubleClick,
  currentNoteId,
  onOpenLinkedNote,
  onCreateCloudTaskFromSelection,
  onCloudTaskToggle,
  onCreateCalendarEventFromSelection,
  onEntityMentionLinkAdded,
  onEntityMentionLinkError,
  editorRef
}: TipTapNoteEditorProps): JSX.Element {
  const isCompact = variant === 'compact'
  const resolvedMinHeight = minHeight ?? (isCompact ? COMPACT_MIN_HEIGHT : DEFAULT_MIN_HEIGHT)
  const editorMinHeightClass = fillHeight
    ? isCompact
      ? 'min-h-[120px]'
      : 'min-h-[200px]'
    : isCompact
      ? 'min-h-[7.5rem]'
      : 'min-h-[12rem]'

  const openLinkedNoteDefault = useCallback((noteId: number): void => {
    useNotesPendingFocusStore.getState().setPendingNoteId(noteId)
    useAppModeStore.getState().setMode('notes')
  }, [])

  const noteWikiLinks = useMemo(
    () => ({
      currentNoteId,
      onOpenNote: onOpenLinkedNote ?? openLinkedNoteDefault,
      onLinkAdded: onEntityMentionLinkAdded,
      onLinkError: onEntityMentionLinkError
    }),
    [
      currentNoteId,
      onOpenLinkedNote,
      openLinkedNoteDefault,
      onEntityMentionLinkAdded,
      onEntityMentionLinkError
    ]
  )

  const openEntityMention = useCallback((target: NoteEntityLinkTarget): void => {
    void openNoteEntityLinkTarget(target, useAppModeStore.getState().setMode)
  }, [])

  const noteEntityMentions = useMemo(
    () =>
      currentNoteId != null
        ? {
            noteId: currentNoteId,
            onOpenEntity: openEntityMention,
            onLinkAdded: onEntityMentionLinkAdded,
            onLinkError: onEntityMentionLinkError
          }
        : undefined,
    [currentNoteId, onEntityMentionLinkAdded, onEntityMentionLinkError, openEntityMention]
  )

  const editorActionBar =
    actionBarStart || showThemeToggle ? (
      <NoteEditorActionBar
        start={actionBarStart}
        end={showThemeToggle ? <ComposeEditorThemeToggle compact /> : undefined}
      />
    ) : null

  return (
    <div
      className={cn(
        'tiptap-note-editor flex min-h-0 flex-col',
        stickyEditorChrome && 'note-editor-sticky-chrome-enabled',
        scrollEditorBodyOnly && 'note-editor-scroll-body-enabled',
        fillHeight && 'min-h-0 flex-1',
        className
      )}
      style={fillHeight ? undefined : { minHeight: resolvedMinHeight }}
    >
      <ComposeEditorSurface
        className={cn(
          'note-editor-surface min-h-0 rounded-md border border-border',
          stickyEditorChrome && !scrollEditorBodyOnly ? 'overflow-visible' : 'overflow-hidden',
          fillHeight && 'flex flex-1 flex-col'
        )}
      >
        <ComposeEditorThemedPane className={cn(fillHeight && 'min-h-0 flex-1 flex flex-col')}>
          <TipTapBody
            inEditorSurface
            enableTaskList
            noteWikiLinks={noteWikiLinks}
            editorActionBar={editorActionBar}
            stickyEditorChrome={stickyEditorChrome}
            scrollEditorBodyOnly={scrollEditorBodyOnly}
            scrollFooter={scrollFooter}
            valueHtml={valueHtml}
            onChangeHtml={onChangeHtml}
            placeholder={placeholder}
            fillHeight={fillHeight}
            flushRef={flushRef}
            insertHtmlRef={insertHtmlRef}
            replaceInkSnapshotRef={replaceInkSnapshotRef}
            noteEntityMentions={noteEntityMentions}
            onInkImageDoubleClick={onInkImageDoubleClick}
            onCreateCloudTask={onCreateCloudTaskFromSelection}
            onCreateCalendarEvent={onCreateCalendarEventFromSelection}
            onCloudTaskToggle={onCloudTaskToggle}
            editorRef={editorRef}
            variant={isCompact ? 'compact' : 'default'}
            editorMinHeightClass={editorMinHeightClass}
            className={cn('!border-t-0', fillHeight && 'min-h-0 flex-1 flex flex-col')}
          />
        </ComposeEditorThemedPane>
      </ComposeEditorSurface>
    </div>
  )
}
