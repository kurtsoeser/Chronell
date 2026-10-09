/** Laufzeit-Konfiguration für die TipTap-Autokorrektur (ohne Editor-Remount). */

let enabled = false
let blocklist = new Set<string>()

export type LastComposeAutoCorrect = { from: string; to: string }

let lastAutoCorrect: LastComposeAutoCorrect | null = null

export function setLastComposeAutoCorrect(entry: LastComposeAutoCorrect | null): void {
  lastAutoCorrect = entry
}

export function getLastComposeAutoCorrect(): LastComposeAutoCorrect | null {
  return lastAutoCorrect
}

export function setComposeAutoCorrectRuntime(next: {
  enabled: boolean
  blocklist: ReadonlySet<string>
}): void {
  enabled = next.enabled
  blocklist = new Set(next.blocklist)
}

export function isComposeAutoCorrectEnabled(): boolean {
  return enabled
}

export function getComposeAutoCorrectBlocklist(): ReadonlySet<string> {
  return blocklist
}

export function parseComposeAutoCorrectBlocklistText(raw: string): Set<string> {
  const out = new Set<string>()
  for (const line of raw.split(/[\n,;]+/)) {
    const w = line.trim().toLowerCase()
    if (w) out.add(w)
  }
  return out
}
