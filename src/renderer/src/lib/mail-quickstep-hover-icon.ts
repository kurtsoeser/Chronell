import { Zap, type LucideIcon } from 'lucide-react'
import type { MailQuickStep, TodoDueKindList } from '@shared/types'
import { todoDueBucketIcon } from '@/lib/todo-due-bucket-icons'

/** Bekannte Standard-QuickSteps (schema-Migrationen). */
const KNOWN_QUICKSTEP_BUCKET_BY_ID: Record<number, TodoDueKindList> = {
  1: 'done',
  2: 'today',
  3: 'tomorrow',
  4: 'this_week',
  5: 'later'
}

function inferBucketFromName(name: string): TodoDueKindList | null {
  const n = name.toLowerCase()
  if (n.includes('überfäll') || n.includes('ueberfaell') || n.includes('overdue')) return 'overdue'
  if (n.includes('heute') || n.includes('today')) return 'today'
  if (n.includes('morgen') || n.includes('tomorrow')) return 'tomorrow'
  if (n.includes('woche') || n.includes('week')) return 'this_week'
  if (n.includes('später') || n.includes('spaeter') || n.includes('later')) return 'later'
  if (
    n.includes('erledigt') ||
    n.includes('archiv') ||
    n.includes('gelesen & archiv') ||
    n.includes('gelesen und archiv')
  ) {
    return 'done'
  }
  return null
}

/** Icon fuer QuickStep in der Maillisten-Mouse-over-Leiste. */
export function resolveQuickStepHoverIcon(quickStep: MailQuickStep): LucideIcon {
  if (quickStep.visualBucket) {
    return todoDueBucketIcon(quickStep.visualBucket)
  }
  const byId = KNOWN_QUICKSTEP_BUCKET_BY_ID[quickStep.id]
  if (byId) return todoDueBucketIcon(byId)
  const byName = inferBucketFromName(quickStep.name)
  if (byName) return todoDueBucketIcon(byName)
  return Zap
}
