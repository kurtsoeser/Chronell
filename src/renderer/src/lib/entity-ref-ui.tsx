import {
  CalendarDays,
  CheckSquare,
  ListTodo,
  Mail,
  StickyNote,
  User,
  type LucideIcon
} from 'lucide-react'
import type { EntityRefKind } from '@shared/entity-ref'

export function entityRefKindIcon(kind: EntityRefKind): LucideIcon {
  switch (kind) {
    case 'mail':
      return Mail
    case 'mail_todo':
      return ListTodo
    case 'calendar_event':
      return CalendarDays
    case 'cloud_task':
      return CheckSquare
    case 'people_contact':
      return User
    default:
      return StickyNote
  }
}
