import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export type ContactVirtualRow<T> =
  | { kind: 'header'; key: string; label: string; bucketKey?: string; count?: number }
  | { kind: 'item'; key: string; data: T }

function rowHeight<T>(row: ContactVirtualRow<T>): number {
  return row.kind === 'header' ? 22 : 28
}

interface Props<T> {
  rows: ContactVirtualRow<T>[]
  className?: string
  renderHeader: (row: Extract<ContactVirtualRow<T>, { kind: 'header' }>) => ReactNode
  renderItem: (row: Extract<ContactVirtualRow<T>, { kind: 'item' }>) => ReactNode
}

export function ContactSidebarVirtualList<T>({
  rows,
  className,
  renderHeader,
  renderItem
}: Props<T>): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rowHeight(rows[index]!),
    overscan: 8
  })

  return (
    <div ref={parentRef} className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index]!
          const style: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${vi.size}px`,
            transform: `translateY(${vi.start}px)`
          }
          return (
            <div key={row.key} style={style} data-index={vi.index}>
              {row.kind === 'header' ? renderHeader(row) : renderItem(row)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
