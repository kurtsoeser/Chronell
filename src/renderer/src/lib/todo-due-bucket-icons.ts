import type { TodoDueKindList } from '@shared/types'
import {
  AlertTriangle,
  Calendar,
  Sunrise,
  CalendarRange,
  CalendarClock,
  CheckCircle2,
  type LucideIcon
} from 'lucide-react'

/** Lucide-Icons fuer ToDo-Faelligkeit (Sidebar, Badges, Maillisten-Hover). */
export const TODO_DUE_BUCKET_ICONS: Record<TodoDueKindList, LucideIcon> = {
  overdue: AlertTriangle,
  today: Calendar,
  tomorrow: Sunrise,
  this_week: CalendarRange,
  later: CalendarClock,
  done: CheckCircle2
}

export function todoDueBucketIcon(kind: TodoDueKindList): LucideIcon {
  return TODO_DUE_BUCKET_ICONS[kind]
}
