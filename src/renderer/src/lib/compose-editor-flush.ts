/** Synchronisiert TipTap-Editoren in den Compose-Store vor Speichern / Unmount. */
const flushers = new Map<string, () => void>()

export function registerComposeEditorFlush(draftId: string, flush: () => void): () => void {
  flushers.set(draftId, flush)
  return (): void => {
    if (flushers.get(draftId) === flush) flushers.delete(draftId)
  }
}

export function flushComposeEditor(draftId: string): void {
  flushers.get(draftId)?.()
}
