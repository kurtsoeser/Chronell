import type { ComposeAttachment } from '@shared/types'
import {
  cleanTeamsMeetingJoinInformationHtml,
  injectTeamsMeetingBlobIntoWebinarInvitation,
  isEffectivelyEmptyCalendarBodyHtml,
  prepareCalendarEventDescriptionFromEditorHtml
} from '@shared/calendar-event-body-html'
import { extractDataUriImagesToCidAttachments } from '@/lib/extract-data-uri-images-to-cid'
import { isWebinarInvitationHtml } from '@/lib/parse-webinar-invitation-html'
import { isWebinarInvitationHtmlLikelyGutted } from '@/lib/build-webinar-attendee-preview-html'
import { prepareWebinarInvitationBodyForGraph } from '@/lib/sanitize-webinar-invitation-html'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'

export type WebinarInvitationSaveBundle = {
  bodyHtml: string | null
  inlineAttachments: ComposeAttachment[]
}

function isEmptyDescriptionHtml(html: string): boolean {
  const trimmed = html.trim()
  return !trimmed || isEffectivelyEmptyCalendarBodyHtml(trimmed)
}

/**
 * Webinar-Einladung fuer Graph vorbereiten:
 * 1. data:-Hero → cid:-Inline-Anhang
 * 2. Sanitize ohne Compose-Editor (Styles/Links bleiben)
 */
export function prepareWebinarInvitationSaveBundle(html: string): WebinarInvitationSaveBundle {
  const trimmed = html.trim()
  if (!trimmed) return { bodyHtml: null, inlineAttachments: [] }
  const { html: withCid, attachments } = extractDataUriImagesToCidAttachments(trimmed)
  const bodyHtml = prepareWebinarInvitationBodyForGraph(withCid)
  return { bodyHtml, inlineAttachments: attachments }
}

/** Compose- oder Webinar-Pfad — nie Compose-Sanitize auf Webinar-Tabellen. */
export function resolveCalendarEventBodyForGraph(
  descriptionHtml: string,
  opts: { isWebinar: boolean }
): WebinarInvitationSaveBundle {
  const trimmed = descriptionHtml.trim()
  if (isEmptyDescriptionHtml(trimmed)) {
    return { bodyHtml: null, inlineAttachments: [] }
  }
  if (opts.isWebinar || isWebinarInvitationHtml(trimmed)) {
    return prepareWebinarInvitationSaveBundle(trimmed)
  }
  return {
    bodyHtml: prepareCalendarEventDescriptionFromEditorHtml(
      trimmed,
      sanitizeComposeHtmlFragment
    ),
    inlineAttachments: []
  }
}

/** Teams-Provision: Join-Blob in Webinar-Slot statt ans Ende anhaengen. */
export function mergeWebinarBodyWithTeamsProvision(
  descriptionHtml: string,
  joinInformationHtml: string | null | undefined,
  joinUrl: string | null,
  joinLinkLabel: string
): WebinarInvitationSaveBundle {
  const trimmed = descriptionHtml.trim()
  if (isEmptyDescriptionHtml(trimmed)) {
    const joinHtml = cleanTeamsMeetingJoinInformationHtml(joinInformationHtml?.trim() || '')
    if (joinHtml) return { bodyHtml: joinHtml, inlineAttachments: [] }
    if (joinUrl) {
      const safeHref = joinUrl
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
      return {
        bodyHtml: `<p><a href="${safeHref}">${joinLinkLabel}</a></p>`,
        inlineAttachments: []
      }
    }
    return { bodyHtml: null, inlineAttachments: [] }
  }

  const bundle = prepareWebinarInvitationSaveBundle(trimmed)
  const joinHtml = cleanTeamsMeetingJoinInformationHtml(joinInformationHtml?.trim() || '')
  if (joinHtml && bundle.bodyHtml) {
    return {
      bodyHtml: injectTeamsMeetingBlobIntoWebinarInvitation(bundle.bodyHtml, joinHtml),
      inlineAttachments: bundle.inlineAttachments
    }
  }
  return bundle
}

/**
 * iframe-Flush kann veraltetes (zerrissenes) HTML liefern, obwohl der State nach
 * „Layout wiederherstellen“ bereits die volle Vorlage haelt.
 */
export function resolveWebinarDescriptionForSave(
  flushedFromEditor: string | undefined,
  stateHtml: string,
  opts?: { chronellWebinarInvitation?: boolean }
): string {
  const fromEditor = (flushedFromEditor ?? stateHtml).trim()
  const fromState = stateHtml.trim()
  if (!fromState) return fromEditor
  if (!fromEditor) return fromState

  const stateIntact =
    isWebinarInvitationHtml(fromState) &&
    !isWebinarInvitationHtmlLikelyGutted(fromState, opts)
  const editorGutted = isWebinarInvitationHtmlLikelyGutted(fromEditor, opts)

  if (stateIntact && editorGutted) return fromState
  if (
    isWebinarInvitationHtml(fromState) &&
    !isWebinarInvitationHtmlLikelyGutted(fromState, opts) &&
    fromEditor.length < fromState.length * 0.55
  ) {
    return fromState
  }
  return fromEditor
}
