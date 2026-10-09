import { useCallback, type MutableRefObject } from 'react'
import { useComposeStore } from '@/stores/compose'

export function useComposeDraftBodyHtmlGetter(
  draftId: string,
  bodyFlushRef: MutableRefObject<(() => void) | null>
): () => string {
  return useCallback((): string => {
    bodyFlushRef.current?.()
    return useComposeStore.getState().drafts.find((d) => d.id === draftId)?.prependRichHtml ?? ''
  }, [bodyFlushRef, draftId])
}
