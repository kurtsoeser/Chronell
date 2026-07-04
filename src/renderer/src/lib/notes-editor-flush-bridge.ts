type NotesEditorFlushFn = () => Promise<void>

const activeFlushes = new Set<NotesEditorFlushFn>()

/** Notes-Editoren registrieren hier den Speicher-Flush für Modulwechsel / App-Exit. */
export function registerNotesEditorFlush(fn: NotesEditorFlushFn): () => void {
  activeFlushes.add(fn)
  return (): void => {
    activeFlushes.delete(fn)
  }
}

export async function flushNotesEditorBeforeLeave(): Promise<void> {
  if (activeFlushes.size === 0) return
  await Promise.all([...activeFlushes].map((fn) => fn()))
}
