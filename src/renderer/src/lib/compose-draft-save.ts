import type { ComposeDraft } from '@/stores/compose'
import { isComposeBodyEffectivelyEmpty } from '@/lib/compose-default-body'

/** Verzögerung nach der letzten Änderung, bis der Entwurf in «Entwürfe» geschrieben wird. */
export const COMPOSE_AUTO_SAVE_DELAY_MS = 1_500

/** Kurze Verzögerung nach dem Öffnen einer Antwort, bis der erste Server-Entwurf angelegt wird. */
export const COMPOSE_REPLY_INITIAL_SAVE_DELAY_MS = 400

export function composeDraftSaveFingerprint(draft: ComposeDraft): string {
  return JSON.stringify({
    accountId: draft.accountId,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    prependRichHtml: draft.prependRichHtml,
    prependPlain: draft.prependPlain,
    signatureRichHtml: draft.signatureRichHtml,
    quotedHtml: draft.quotedHtml,
    attachments: draft.attachments.map((a) => ({ id: a.id, name: a.name, size: a.size })),
    referenceAttachments: draft.referenceAttachments.map((r) => ({
      id: r.id,
      name: r.name,
      webUrl: r.webUrl
    }))
  })
}

export function hasComposeDraftContent(draft: ComposeDraft): boolean {
  const hasBody =
    (draft.prependRichHtml.trim() && !isComposeBodyEffectivelyEmpty(draft.prependRichHtml)) ||
    draft.prependPlain.trim()
  return Boolean(
    draft.to.trim() ||
      draft.cc.trim() ||
      draft.bcc.trim() ||
      draft.subject.trim() ||
      hasBody ||
      draft.attachments.length > 0 ||
      draft.referenceAttachments.length > 0
  )
}
