import { useEffect, useRef, type MutableRefObject } from 'react'
import { registerComposeEditorFlush } from '@/lib/compose-editor-flush'

/** Registriert Body- und Signatur-Editor-Flush fuer einen Compose-Entwurf. */
export function useComposeDraftEditorFlush(draftId: string): {
  bodyFlushRef: MutableRefObject<(() => void) | null>
  signatureFlushRef: MutableRefObject<(() => void) | null>
} {
  const bodyFlushRef = useRef<(() => void) | null>(null)
  const signatureFlushRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return registerComposeEditorFlush(draftId, () => {
      bodyFlushRef.current?.()
      signatureFlushRef.current?.()
    })
  }, [draftId])

  return { bodyFlushRef, signatureFlushRef }
}
