import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import {
  buildWebinarAttendeePreviewHtml,
  isWebinarInvitationHtmlLikelyGutted
} from '@/lib/build-webinar-attendee-preview-html'
import {
  buildWebinarInvitationHtml,
  defaultKurtrocksWebinarSignatureHtml
} from '@/lib/build-webinar-invitation-html'
import { prepareWebinarInvitationSaveBundle } from '@/lib/prepare-webinar-invitation-save'
import { readWebinarInvitationDefaults, resolveWebinarDefaultsLayoutHtml } from '@/lib/webinar-invitation-defaults-storage'

export function formatWebinarScheduleLabelFromEvent(input: {
  startIso: string
  endIso: string
  isAllDay: boolean
  locale: string
}): string | null {
  try {
    const start = parseISO(input.startIso)
    const end = parseISO(input.endIso)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const loc = input.locale.startsWith('de') ? de : enUS
    if (input.isAllDay) {
      return format(start, 'EEEE, d. MMMM yyyy', { locale: loc })
    }
    const dayFmt = new Intl.DateTimeFormat(input.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const timeFmt = new Intl.DateTimeFormat(input.locale, {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `${dayFmt.format(start)} | ${timeFmt.format(start)} – ${timeFmt.format(end)}`
  } catch {
    return null
  }
}

/** Baut die Kurtrocks-Vorlage aus Termin-Metadaten (wenn Graph-Body kaputt ist). */
export function buildWebinarRepairInvitationHtml(input: {
  title: string
  startIso: string
  endIso: string
  isAllDay: boolean
  locale: string
  joinUrl: string | null
}): string {
  const defaults = readWebinarInvitationDefaults()
  const title = input.title.trim() || 'Webinar'
  return buildWebinarInvitationHtml({
    title,
    heroImageSrc: defaults.defaultHeroImageSrc,
    surveyUrl: defaults.defaultSurveyUrl,
    surveyLabel: defaults.surveyLabel,
    websiteUrl: defaults.defaultWebsiteUrl,
    websiteLabel: defaults.websiteLabel,
    scheduleLabel: formatWebinarScheduleLabelFromEvent(input),
    teamsJoinUrl: input.joinUrl,
    greetingHtml: defaults.greetingHtml,
    tipsHtml: defaults.tipsHtml,
    signOffHtml: defaults.signOffHtml,
    layoutHtmlTemplate: resolveWebinarDefaultsLayoutHtml(defaults),
    signatureHtml: defaults.signatureHtml || defaultKurtrocksWebinarSignatureHtml()
  })
}

export function buildWebinarRepairPreviewHtml(input: {
  title: string
  startIso: string
  endIso: string
  isAllDay: boolean
  locale: string
  joinUrl: string | null
  graphBodyHtml: string
}): string {
  const editorHtml = buildWebinarRepairInvitationHtml(input)
  return buildWebinarAttendeePreviewHtml(editorHtml, input.graphBodyHtml)
}

export function isWebinarGraphBodyLikelyGutted(
  graphBodyHtml: string,
  chronellWebinarInvitation: boolean
): boolean {
  return isWebinarInvitationHtmlLikelyGutted(graphBodyHtml, { chronellWebinarInvitation })
}

export function prepareWebinarRepairSaveBundle(input: {
  title: string
  startIso: string
  endIso: string
  isAllDay: boolean
  locale: string
  joinUrl: string | null
}) {
  return prepareWebinarInvitationSaveBundle(buildWebinarRepairInvitationHtml(input))
}
