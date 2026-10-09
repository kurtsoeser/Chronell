import type { Session } from 'electron'
import { pickChromiumSpellCheckerLanguages } from '@shared/chromium-spellchecker-languages'

/** Setzt Wörterbuch-Sprachen für Chromiums Rechtschreibprüfung (z. B. de-DE im Compose-Editor). */
export function configureDefaultSessionSpellChecker(session: Session): void {
  const available = session.availableSpellCheckerLanguages
  const languages = pickChromiumSpellCheckerLanguages(available)
  if (languages.length === 0) return
  session.setSpellCheckerLanguages(languages)
}
