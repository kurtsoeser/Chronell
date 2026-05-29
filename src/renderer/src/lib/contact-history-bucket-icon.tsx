import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleHelp,
  History
} from 'lucide-react'

/** Lucide-Icon passend zum Datums-Bucket (`contactHistoryDateBucket` / `group.key`). */
export function contactHistoryBucketIcon(bucketKey: string): LucideIcon {
  if (bucketKey === 'today') return CalendarClock
  if (bucketKey === 'yesterday') return History
  if (bucketKey.startsWith('weekday:')) return CalendarDays
  if (bucketKey === 'last-week') return CalendarRange
  if (bucketKey === 'this-month' || bucketKey.startsWith('month:')) return Calendar
  return CircleHelp
}
