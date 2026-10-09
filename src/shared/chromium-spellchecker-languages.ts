/** Bevorzugte Reihenfolge für die Chromium-Rechtschreibprüfung (Compose/Mail). */
export const CHROMIUM_SPELLCHECK_LANGUAGE_PREFERENCE = [
  'de-DE',
  'de',
  'en-US',
  'en-GB',
  'en'
] as const

/**
 * Wählt aus den vom System gemeldeten Sprachen die bevorzugten Wörterbücher.
 * Leeres Array, wenn keine Präferenz verfügbar ist (Chromium behält dann Defaults).
 */
export function pickChromiumSpellCheckerLanguages(
  available: readonly string[],
  preferred: readonly string[] = CHROMIUM_SPELLCHECK_LANGUAGE_PREFERENCE
): string[] {
  const picked: string[] = []
  for (const lang of preferred) {
    if (available.includes(lang) && !picked.includes(lang)) {
      picked.push(lang)
    }
  }
  return picked
}
