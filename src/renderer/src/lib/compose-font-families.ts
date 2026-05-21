/**
 * Schriftarten im E-Mail-Composer.
 *
 * - **UI der App:** `--chronell-font-family` → Noto Sans via `@fontsource/noto-sans` in `main.tsx`
 * - **Composer-Dropdown:** inline `font-family` im TipTap-HTML (Empfänger brauchen die Schrift ggf. selbst)
 * - **Google-Fonts-ähnliche Schriften:** gebündelt über `@fontsource/*` (offline, CSP-konform)
 * - **Web-Safe / System:** Arial, Georgia, … — keine Extra-Pakete
 */

export interface ComposeFontFamily {
  id: string
  /** Anzeige im Dropdown */
  label: string
  /** Wert für CSS / TipTap `setFontFamily` */
  value: string
  /**
   * Optional: `@fontsource/<name>` — wird beim ersten Gebrauch geladen.
   * Ohne Eintrag wird nur `value` gesetzt (System-/Web-Safe-Schriften).
   */
  fontsource?: string
}

/** System- und Web-Safe-Schriften (überall verfügbar, kein Download). */
const WEB_SAFE_COMPOSE_FONTS: ComposeFontFamily[] = [
  { id: 'system', label: 'System', value: 'system-ui, sans-serif' },
  { id: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia', value: 'Georgia, serif' },
  { id: 'courier', label: 'Courier New', value: "'Courier New', Courier, monospace" },
  { id: 'times', label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { id: 'trebuchet', label: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { id: 'verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif' }
]

/** Kostenlose Schriften (SIL/OFL) — gleiche Familien wie bei Google Fonts, via Fontsource gebündelt. */
const BUNDLED_COMPOSE_FONTS: ComposeFontFamily[] = [
  { id: 'noto-sans', label: 'Noto Sans', value: "'Noto Sans', sans-serif", fontsource: 'noto-sans' },
  { id: 'noto-serif', label: 'Noto Serif', value: "'Noto Serif', serif", fontsource: 'noto-serif' },
  { id: 'raleway', label: 'Raleway', value: "'Raleway', sans-serif", fontsource: 'raleway' },
  { id: 'roboto', label: 'Roboto', value: "'Roboto', sans-serif", fontsource: 'roboto' },
  { id: 'open-sans', label: 'Open Sans', value: "'Open Sans', sans-serif", fontsource: 'open-sans' },
  { id: 'lato', label: 'Lato', value: "'Lato', sans-serif", fontsource: 'lato' },
  { id: 'inter', label: 'Inter', value: "'Inter', sans-serif", fontsource: 'inter' },
  {
    id: 'source-sans-3',
    label: 'Source Sans 3',
    value: "'Source Sans 3', sans-serif",
    fontsource: 'source-sans-3'
  },
  { id: 'nunito', label: 'Nunito', value: "'Nunito', sans-serif", fontsource: 'nunito' },
  { id: 'pt-sans', label: 'PT Sans', value: "'PT Sans', sans-serif", fontsource: 'pt-sans' },
  { id: 'oswald', label: 'Oswald', value: "'Oswald', sans-serif", fontsource: 'oswald' },
  {
    id: 'merriweather',
    label: 'Merriweather',
    value: "'Merriweather', serif",
    fontsource: 'merriweather'
  }
]

export const COMPOSE_FONT_FAMILIES: readonly ComposeFontFamily[] = [
  ...WEB_SAFE_COMPOSE_FONTS,
  ...BUNDLED_COMPOSE_FONTS
]
