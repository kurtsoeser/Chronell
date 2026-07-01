import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { SchedulingSlot } from './scheduling-types'

export type SchedulingInvitationLocale = 'de' | 'en'

function dateFnsLocale(code: SchedulingInvitationLocale) {
  return code === 'de' ? de : enUS
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatSchedulingSlotLine(
  slot: SchedulingSlot,
  locale: SchedulingInvitationLocale
): string {
  const loc = dateFnsLocale(locale)
  const start = parseISO(slot.startIso)
  const end = parseISO(slot.endIso)
  if (slot.isAllDay) {
    const sameDay =
      format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd') ||
      format(end, 'yyyy-MM-dd') === format(new Date(end.getTime() - 86400000), 'yyyy-MM-dd')
    if (sameDay) {
      return format(start, locale === 'de' ? 'EEE d. MMM' : 'EEE, MMM d', { locale: loc })
    }
    return `${format(start, locale === 'de' ? 'EEE d. MMM' : 'EEE, MMM d', { locale: loc })} – ${format(end, locale === 'de' ? 'EEE d. MMM' : 'EEE, MMM d', { locale: loc })}`
  }
  const dayPart = format(start, locale === 'de' ? 'EEE d. MMM' : 'EEE, MMM d', { locale: loc })
  const timePart = `${format(start, 'HH:mm', { locale: loc })} – ${format(end, 'HH:mm', { locale: loc })}`
  return `${dayPart}, ${timePart}`
}

function timeZoneLabel(timeZone: string, locale: SchedulingInvitationLocale): string {
  try {
    const parts = new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      timeZone,
      timeZoneName: 'short'
    }).formatToParts(new Date())
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value
    return tz ? `${tz} (${timeZone})` : timeZone
  } catch {
    return timeZone
  }
}

export function buildSchedulingInvitationText(options: {
  slots: SchedulingSlot[]
  bookWithMeUrl: string | null
  durationMinutes: number
  locale: SchedulingInvitationLocale
  timeZone: string
  meetingTitle?: string
}): string {
  const { slots, bookWithMeUrl, durationMinutes, locale, timeZone, meetingTitle } = options
  if (slots.length === 0) return ''

  const lines: string[] = []
  if (meetingTitle?.trim()) {
    lines.push(meetingTitle.trim())
    lines.push('')
  }

  lines.push(locale === 'de' ? 'Vorgeschlagene Termine:' : 'Proposed times:')
  for (const slot of slots) {
    lines.push(`• ${formatSchedulingSlotLine(slot, locale)}`)
  }
  lines.push('')

  if (bookWithMeUrl?.trim()) {
    lines.push(bookWithMeUrl.trim())
    lines.push('')
  }

  lines.push(
    locale === 'de'
      ? `Termindauer: ${durationMinutes} Min.`
      : `Meeting duration: ${durationMinutes} min`
  )
  lines.push(timeZoneLabel(timeZone, locale))

  return lines.join('\n').trim()
}

export function buildSchedulingInvitationHtml(options: {
  slots: SchedulingSlot[]
  bookWithMeUrl: string | null
  durationMinutes: number
  locale: SchedulingInvitationLocale
  timeZone: string
  meetingTitle?: string
}): string {
  const { slots, bookWithMeUrl, durationMinutes, locale, timeZone, meetingTitle } = options
  if (slots.length === 0) return ''

  const parts: string[] = []
  if (meetingTitle?.trim()) {
    parts.push(`<p>${escapeHtml(meetingTitle.trim())}</p>`)
  }
  const listLabel = locale === 'de' ? 'Vorgeschlagene Termine:' : 'Proposed times:'
  const items = slots
    .map((s) => `<li>${escapeHtml(formatSchedulingSlotLine(s, locale))}</li>`)
    .join('')
  parts.push(`<p>${escapeHtml(listLabel)}</p><ul>${items}</ul>`)
  if (bookWithMeUrl?.trim()) {
    const url = escapeHtml(bookWithMeUrl.trim())
    parts.push(`<p><a href="${url}">${url}</a></p>`)
  }
  const dur =
    locale === 'de'
      ? `Termindauer: ${durationMinutes} Min.`
      : `Meeting duration: ${durationMinutes} min`
  parts.push(`<p>${escapeHtml(dur)}<br>${escapeHtml(timeZoneLabel(timeZone, locale))}</p>`)
  return parts.join('')
}

const URL_IN_TEXT_RE = /(https?:\/\/[^\s<>"']+)/gi

function linkifyEscapedHtml(escaped: string): string {
  return escaped.replace(URL_IN_TEXT_RE, (url) => `<a href="${url}">${url}</a>`)
}

function plainLineToHtml(line: string): string {
  return linkifyEscapedHtml(escapeHtml(line))
}

/** Plain-Text mit Zeilenumbruechen in einfaches HTML fuer den Mailversand. */
export function schedulingPlainTextToHtml(plain: string): string {
  const blocks = plain.split(/\n{2,}/)
  return blocks
    .map((block) => {
      const trimmed = block.trim()
      if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
        const url = escapeHtml(trimmed)
        return `<p><a href="${url}">${url}</a></p>`
      }

      const lines = block.split('\n')
      const bulletLines = lines.every((l) => /^[•-]\s/.test(l.trim()) || l.trim() === '')
      if (bulletLines && lines.some((l) => /^[•-]\s/.test(l.trim()))) {
        const items = lines
          .filter((l) => /^[•-]\s/.test(l.trim()))
          .map((l) => `<li>${plainLineToHtml(l.trim().replace(/^[•-]\s*/, ''))}</li>`)
          .join('')
        const head = lines.find((l) => l.trim() && !/^[•-]\s/.test(l.trim()))
        return `${head ? `<p>${plainLineToHtml(head)}</p>` : ''}<ul>${items}</ul>`
      }
      return `<p>${lines.map((l) => plainLineToHtml(l)).join('<br>')}</p>`
    })
    .join('')
}
