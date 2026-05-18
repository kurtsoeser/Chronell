import { useEffect, useRef } from 'react'
import { useComposeStore, type ComposeDraft } from '@/stores/compose'

const AUTO_SAVE_DELAY_MS = 30_000

function draftSaveFingerprint(draft: ComposeDraft): string {
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

function hasDraftContent(draft: ComposeDraft): boolean {
  return Boolean(
    draft.to.trim() ||
      draft.cc.trim() ||
      draft.bcc.trim() ||
      draft.subject.trim() ||
      draft.prependRichHtml.trim() ||
      draft.prependPlain.trim() ||
      draft.attachments.length > 0 ||
      draft.referenceAttachments.length > 0
  )
}

/** Speichert den Entwurf nach 30 s Inaktivitaet im Server-Ordner «Entwürfe». */
export function useComposeAutoSave(draftId: string, enabled = true): void {
  const draft = useComposeStore((s) => s.drafts.find((d) => d.id === draftId))
  const saveRemoteDraft = useComposeStore((s) => s.saveRemoteDraft)
  const lastSavedFingerprint = useRef<string | null>(null)
  const wasBusy = useRef(false)

  const fingerprint = draft ? draftSaveFingerprint(draft) : null

  useEffect(() => {
    lastSavedFingerprint.current = null
    wasBusy.current = false
  }, [draftId])

  useEffect(() => {
    if (wasBusy.current && draft && !draft.busy && !draft.error) {
      lastSavedFingerprint.current = draftSaveFingerprint(draft)
    }
    wasBusy.current = draft?.busy ?? false
  }, [draft?.busy, draft?.error, draft, fingerprint])

  useEffect(() => {
    if (!enabled || !draft || !fingerprint || draft.busy || !hasDraftContent(draft)) return

    const timer = window.setTimeout(() => {
      const current = useComposeStore.getState().drafts.find((d) => d.id === draftId)
      if (!current || current.busy || !hasDraftContent(current)) return

      const fp = draftSaveFingerprint(current)
      if (lastSavedFingerprint.current === fp) return

      void saveRemoteDraft(draftId).then(() => {
        const after = useComposeStore.getState().drafts.find((d) => d.id === draftId)
        if (after && !after.error) {
          lastSavedFingerprint.current = draftSaveFingerprint(after)
        }
      })
    }, AUTO_SAVE_DELAY_MS)

    return (): void => window.clearTimeout(timer)
  }, [draftId, enabled, fingerprint, draft?.busy, saveRemoteDraft])
}
