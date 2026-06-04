import { useEffect, useRef } from 'react'
import {
  COMPOSE_AUTO_SAVE_DELAY_MS,
  composeDraftSaveFingerprint,
  hasComposeDraftContent
} from '@/lib/compose-draft-save'
import { useComposeStore, type ComposeDraft } from '@/stores/compose'

/** Speichert den Entwurf nach kurzer Inaktivität im Server-Ordner «Entwürfe». */
export function useComposeAutoSave(draftId: string, enabled = true): void {
  const draft = useComposeStore((s) => s.drafts.find((d) => d.id === draftId))
  const saveRemoteDraft = useComposeStore((s) => s.saveRemoteDraft)
  const lastSavedFingerprint = useRef<string | null>(null)
  const wasBusy = useRef(false)

  const fingerprint = draft ? composeDraftSaveFingerprint(draft) : null

  useEffect(() => {
    lastSavedFingerprint.current = null
    wasBusy.current = false
  }, [draftId])

  useEffect(() => {
    if (wasBusy.current && draft && !draft.busy && !draft.error) {
      lastSavedFingerprint.current = composeDraftSaveFingerprint(draft)
    }
    wasBusy.current = draft?.busy ?? false
  }, [draft?.busy, draft?.error, draft, fingerprint])

  useEffect(() => {
    if (!enabled || !draft || !fingerprint || draft.busy || !hasComposeDraftContent(draft)) return

    const timer = window.setTimeout(() => {
      const current = useComposeStore.getState().drafts.find((d) => d.id === draftId)
      if (!current || current.busy || !hasComposeDraftContent(current)) return

      const fp = composeDraftSaveFingerprint(current)
      if (lastSavedFingerprint.current === fp) return

      void saveRemoteDraft(draftId).then(() => {
        const after = useComposeStore.getState().drafts.find((d) => d.id === draftId)
        if (after && !after.error) {
          lastSavedFingerprint.current = composeDraftSaveFingerprint(after)
        }
      })
    }, COMPOSE_AUTO_SAVE_DELAY_MS)

    return (): void => window.clearTimeout(timer)
  }, [draftId, enabled, fingerprint, draft?.busy, saveRemoteDraft])
}
