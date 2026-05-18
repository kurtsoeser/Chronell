import { schedulingPlainTextToHtml } from '@shared/scheduling-invitation'
import { parseRecipients } from '@/lib/compose-helpers'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { useAccountsStore } from '@/stores/accounts'

function signatureHtmlForAccount(accountId: string): string {
  const acc = useAccountsStore.getState().accounts.find((a) => a.id === accountId)
  if (!acc?.signatureTemplates?.length) return ''
  const defId = acc.defaultSignatureTemplateId
  if (defId === null || defId === undefined || defId === '') return ''
  const tpl = acc.signatureTemplates.find((t) => t.id === defId)
  const raw = tpl?.html?.trim() ?? ''
  if (!raw) return ''
  return sanitizeComposeHtmlFragment(raw)
}

export async function sendSchedulingInvitationMail(options: {
  accountId: string
  to: string
  cc?: string
  subject: string
  bodyPlain: string
}): Promise<void> {
  const to = parseRecipients(options.to)
  if (to.length === 0) {
    throw new Error('Bitte mindestens einen Empfaenger angeben.')
  }
  const cc = options.cc?.trim() ? parseRecipients(options.cc) : []

  const sig = signatureHtmlForAccount(options.accountId)
  const sigBlock = sig ? `<p></p>${sig}` : ''
  const bodyHtml = schedulingPlainTextToHtml(options.bodyPlain) + sigBlock

  await window.mailClient.compose.send({
    accountId: options.accountId,
    subject: options.subject.trim() || '(Kein Betreff)',
    bodyHtml,
    to,
    cc: cc.length ? cc : undefined
  })
}
