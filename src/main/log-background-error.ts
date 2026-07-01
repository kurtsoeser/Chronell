/** Protokolliert erwartete Hintergrund-Fehler im Main-Prozess (ohne UI). */
export function logBackgroundError(context: string, err: unknown): void {
  console.warn(`[main] ${context}`, err)
}
