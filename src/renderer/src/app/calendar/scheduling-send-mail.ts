import { schedulingPlainTextToHtml } from '@shared/scheduling-invitation'
import { parseRecipients } from '@/lib/compose-helpers'
import { initialSignatureForAccount } from '@/lib/signature-templates'

export async function sendSchedulingInvitationMail(options: {
  accountId: string
  to: string
  cc?: string
  subject: string
  bodyPlain: string
}): Promise<void> {
  const to = parseRecipients(options.to)
  if (to.length === 0) {
    throw new Error('SCHEDULING_RECIPIENT_REQUIRED')
  }
  const cc = options.cc?.trim() ? parseRecipients(options.cc) : []

  const sig = initialSignatureForAccount(options.accountId).html
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
