import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { NotesPageFlatRow } from '@/lib/notes-page-tree'
import { cn } from '@/lib/utils'

const ROW_GAP_PX = 2

function estimateNotesPageRowHeight(row: NotesPageFlatRow, showSectionLabels: boolean): number {
  const hasCategories = (row.note.categories?.length ?? 0) > 0
  const hasSectionLabel = showSectionLabels
  let height = 44
  if (hasCategories) height += 22
  if (hasCategories && hasSectionLabel) height += 4
  height += 16
  return height + ROW_GAP_PX
}

export function NotesPagesVirtualList({
  pageRows,
  showSectionLabels = false,
  activeNoteId = null,
  className,
  renderRow
}: {
  pageRows: NotesPageFlatRow[]
  showSectionLabels?: boolean
  activeNoteId?: number | null
  className?: string
  renderRow: (row: NotesPageFlatRow) => ReactNode
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const activeNoteIdRef = useRef(activeNoteId)
  activeNoteIdRef.current = activeNoteId

  const virtualizer = useVirtualizer({
    count: pageRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateNotesPageRowHeight(pageRows[index]!, showSectionLabels),
    overscan: 12,
    measureElement: (element) => element.getBoundingClientRect().height + ROW_GAP_PX
  })

  useEffect(() => {
    const noteId = activeNoteIdRef.current
    if (noteId == null) return
    const index = pageRows.findIndex((row) => row.note.id === noteId)
    if (index < 0) return
    virtualizer.scrollToIndex(index, { align: 'auto' })
    // Nur bei Seitenwechsel oder erstem Listenaufbau scrollen.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageRows/ virtualizer absichtlich ausgeschlossen
  }, [activeNoteId, pageRows.length])

  return (
    <div ref={parentRef} className={cn('min-h-0 flex-1 overflow-y-auto px-2 py-2', className)}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = pageRows[virtualRow.index]!
          const style: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`
          }
          return (
            <div
              key={row.note.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={style}
              className="pb-0.5"
            >
              {renderRow(row)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
