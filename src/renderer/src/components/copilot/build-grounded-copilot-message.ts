/** Prompt + Kontext in einer Nachricht — Copilot nutzt additionalContext oft nicht zuverlässig. */
export function buildGroundedCopilotMessage(prompt: string, contexts: string[]): string {
  const ctx = contexts
    .map((c) => c.trim())
    .filter(Boolean)
    .join('\n\n')
  const p = prompt.trim()
  if (!ctx) return p
  return `${p}\n\n---\n${ctx}\n---`
}
