type NotesEditorFlushFn = () => Promise<void>

let activeFlush: NotesEditorFlushFn | null = null

/** NotesShell registriert hier den Speicher-Flush fuer Modulwechsel / App-Exit. */
export function registerNotesEditorFlush(fn: NotesEditorFlushFn): () => void {
  activeFlush = fn
  return (): void => {
    if (activeFlush === fn) activeFlush = null
  }
}

export async function flushNotesEditorBeforeLeave(): Promise<void> {
  if (!activeFlush) return
  await activeFlush()
}
