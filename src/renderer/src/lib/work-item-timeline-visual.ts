import type { CSSProperties } from 'react'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { tailwindAccountBgToHex } from '@/lib/calendar-event-chip-style'

/** Visuelle Typ-Akzente für Zeitliste (Fallback ohne Konto-/Kalenderfarbe). */
export type WorkItemTimelineVisualKind = 'mail' | 'calendar' | 'task'

export function workItemTimelineVisualKind(item: WorkItem): WorkItemTimelineVisualKind {
  if (item.kind === 'calendar_event') return 'calendar'
  if (item.kind === 'mail_todo') return 'mail'
  if (item.kind === 'cloud_task' && item.linkedMessageIds.length > 0) return 'mail'
  return 'task'
}

function accountAccentHex(account: ConnectedAccount | null | undefined): string | null {
  if (!account) return null
  const css = resolvedAccountColorCss(account.color)
  if (/^#[0-9A-Fa-f]{6}$/i.test(css)) return css
  return tailwindAccountBgToHex(css)
}

/** Konto- bzw. Kalenderfarbe (#RRGGBB), analog Gantt/Kalender-Raster. */
export function workItemTimelineAccentHex(
  item: WorkItem,
  account: ConnectedAccount | null | undefined
): string | null {
  if (item.kind === 'calendar_event') {
    const ev = item.event
    const fromEvent =
      ev.displayColorHex?.trim() ||
      tailwindAccountBgToHex(ev.accountColorClass) ||
      null
    return fromEvent || accountAccentHex(account)
  }
  return accountAccentHex(account)
}

const STRIPE_CLASS: Record<WorkItemTimelineVisualKind, string> = {
  mail: 'bg-emerald-500/85',
  calendar: 'bg-sky-500/85',
  task: 'bg-[#7B61FF]/90'
}

const ICON_WRAP_CLASS: Record<WorkItemTimelineVisualKind, string> = {
  mail: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/35 dark:text-emerald-400',
  calendar: 'bg-sky-500/15 text-sky-600 ring-sky-500/35 dark:text-sky-400',
  task: 'bg-[#7B61FF]/15 text-[#7B61FF] ring-[#7B61FF]/35'
}

export function workItemTimelineStripeClass(item: WorkItem): string {
  return STRIPE_CLASS[workItemTimelineVisualKind(item)]
}

export function workItemTimelineIconWrapClass(item: WorkItem): string {
  return ICON_WRAP_CLASS[workItemTimelineVisualKind(item)]
}

export function workItemTimelineStripeStyle(hex: string | null): CSSProperties | undefined {
  if (!hex) return undefined
  return { backgroundColor: hex }
}

export function workItemTimelineIconWrapStyle(hex: string | null): CSSProperties | undefined {
  if (!hex) return undefined
  return {
    color: hex,
    backgroundColor: `${hex}1a`,
    boxShadow: `inset 0 0 0 1px ${hex}45`
  }
}
