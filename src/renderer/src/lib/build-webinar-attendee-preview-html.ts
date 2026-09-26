import {
  extractRawTeamsOnlineMeetingBlob,
  injectTeamsMeetingBlobIntoWebinarInvitation,
  lightenEmbeddedTeamsMeetingBlobInWebinarHtml,
  stripTeamsMeetingJoinBlockHtml
} from '@shared/calendar-event-body-html'
import { isWebinarInvitationHtml } from '@/lib/parse-webinar-invitation-html'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'

/**
 * Vorschau wie TN/Outlook: intaktes Editor-HTML + Teams-Blob aus Graph.
 * Gespeicherter Graph-Body nur, wenn Editor leer oder Layout beschaedigt.
 */
export function buildWebinarAttendeePreviewHtml(
  editorHtml: string,
  graphBodyHtml: string | null | undefined
): string {
  const graph = graphBodyHtml?.trim() ?? ''
  const editor = editorHtml.trim()

  const finish = (html: string): string =>
    sanitizeWebinarInvitationHtml(lightenEmbeddedTeamsMeetingBlobInWebinarHtml(html))

  if (editor && isWebinarInvitationHtml(editor) && !isWebinarInvitationHtmlLikelyGutted(editor)) {
    const blob = extractRawTeamsOnlineMeetingBlob(graph)
    if (blob) {
      return finish(injectTeamsMeetingBlobIntoWebinarInvitation(editor, blob))
    }
    return finish(editor)
  }

  if (graph && isWebinarInvitationHtml(graph) && !isWebinarInvitationHtmlLikelyGutted(graph)) {
    return finish(graph)
  }

  if (graph) return finish(graph)
  if (editor) return finish(editor)
  return ''
}

function hasIntactKurtrocksLayout(html: string): boolean {
  const layoutHtml = stripTeamsMeetingJoinBlockHtml(html) || html
  if (layoutHtml.includes('chronell-webinar-teams-slot')) return true
  if (layoutHtml.includes('chronell-webinar-schedule')) return true
  if (layoutHtml.includes('chronell-webinar-hero-slot')) return true
  if (layoutHtml.includes('font:700 24px') || layoutHtml.includes('font:700 28px')) return true
  if (
    (layoutHtml.includes('bgcolor="#121212"') || layoutHtml.includes('bgcolor="#0f0f0f"')) &&
    layoutHtml.includes('role="presentation"') &&
    /Hinweise\s*(?:&amp;|&)\s*Hilfen/i.test(layoutHtml)
  ) {
    return true
  }
  return false
}

/** Erkennt zerrissenes Webinar-HTML (nur Textfragmente, kein Layout). Leer ≠ beschädigt. */
export function isWebinarInvitationHtmlLikelyGutted(
  html: string | null | undefined,
  opts?: { chronellWebinarInvitation?: boolean }
): boolean {
  const raw = html?.trim() ?? ''
  if (!raw) return false

  if (hasIntactKurtrocksLayout(raw)) return false

  if (isWebinarInvitationHtml(raw)) return true
  if (opts?.chronellWebinarInvitation) return true
  return false
}

/** Eine Funktion für Dialog-Vorschau, Terminvorschau und TN-Ansicht. */
export const composeAttendeeInvitationHtml = buildWebinarAttendeePreviewHtml
