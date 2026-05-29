/** Heuristik: Mail sieht nach einer Online-Meeting-Einladung aus (ohne .ics-Anhang). */
export function looksLikeMeetingInvitationMail(msg: {
  subject?: string | null
  bodyHtml?: string | null
  bodyText?: string | null
  snippet?: string | null
  fromAddr?: string | null
}): boolean {
  const hay = [msg.subject, msg.bodyHtml, msg.bodyText, msg.snippet]
    .filter(Boolean)
    .join('\n')
  if (!hay.trim()) return false

  if (/teams\.microsoft\.com\/(?:meet|l\/meetup-join)/i.test(hay)) return true
  if (/teams\.live\.com\/meet\//i.test(hay)) return true
  if (/microsoft teams[-\s]?(besprechung|meeting)/i.test(hay)) return true
  if (/(besprechungs-id|meeting id):/i.test(hay) && /teams/i.test(hay)) return true
  if (/einladung.*termin|meeting invitation|calendar invitation/i.test(hay)) return true

  const subj = (msg.subject ?? '').trim()
  if (/^(akzeptiert|accepted|abgelehnt|declined|tentative|zugesagt):\s/i.test(subj)) return true

  return false
}
