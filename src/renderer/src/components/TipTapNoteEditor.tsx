import { useCallback, useMemo, type MutableRefObject, type ReactNode } from 'react'
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
  flushRef?: MutableRefObject<(() => void) | null>
  insertHtmlRef?: MutableRefObject<((html: string) => void) | null>
  currentNoteId?: number
  onOpenLinkedNote?: (noteId: number) => void
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
  flushRef,
  insertHtmlRef,
  currentNoteId,
  onOpenLinkedNote
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
      onOpenNote: onOpenLinkedNote ?? openLinkedNoteDefault
    }),
    [currentNoteId, onOpenLinkedNote, openLinkedNoteDefault]
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
        fillHeight && 'min-h-0 flex-1',
        className
      )}
      style={fillHeight ? undefined : { minHeight: resolvedMinHeight }}
    >
      <ComposeEditorSurface
        className={cn(
          'note-editor-surface min-h-0 rounded-md border border-border',
          stickyEditorChrome ? 'overflow-visible' : 'overflow-hidden',
          fillHeight && 'flex flex-1 flex-col'
        )}
      >
        <ComposeEditorThemedPane className={cn(fillHeight && 'min-h-0 flex-1')}>
          <TipTapBody
            inEditorSurface
            enableTaskList
            noteWikiLinks={noteWikiLinks}
            editorActionBar={editorActionBar}
            stickyEditorChrome={stickyEditorChrome}
            valueHtml={valueHtml}
            onChangeHtml={onChangeHtml}
            placeholder={placeholder}
            fillHeight={fillHeight}
            flushRef={flushRef}
            insertHtmlRef={insertHtmlRef}
            variant={isCompact ? 'compact' : 'default'}
            editorMinHeightClass={editorMinHeightClass}
            className={cn('!border-t-0', fillHeight && 'min-h-0 flex-1')}
          />
        </ComposeEditorThemedPane>
      </ComposeEditorSurface>
    </div>
  )
}
