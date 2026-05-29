import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { LucideIcon } from 'lucide-react'
import { MailRightSidebarTile } from '@/app/layout/mail-right-sidebar/MailRightSidebarTile'
import type { MailRightSidebarTileId } from '@/app/layout/mail-right-sidebar/mail-right-sidebar-dashboard-storage'

export function MailRightSidebarSortableTile(props: {
  id: MailRightSidebarTileId
  title: string
  subtitle?: string
  icon?: LucideIcon
  onOpenFull?: () => void
  hideDisabled?: boolean
  onHide: () => void
  bodyClassName?: string
  children: React.ReactNode
}): JSX.Element {
  const { id, children, ...tileProps } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 4, position: 'relative' } : {})
  }

  return (
    <div ref={setNodeRef} style={style} className="w-full min-w-0">
      <MailRightSidebarTile
        {...tileProps}
        isDragging={isDragging}
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
      >
        {children}
      </MailRightSidebarTile>
    </div>
  )
}
