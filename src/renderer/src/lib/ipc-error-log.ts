/** Protokolliert IPC-Fehler im Renderer (Hintergrund-Aufrufe ohne UI-Feedback). */
export function logIpcError(context: string, err: unknown): void {
  console.warn(`[ipc] ${context}`, err)
}
