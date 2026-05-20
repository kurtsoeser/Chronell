import { cn } from '@/lib/utils'

/** Modul-Root: Nav auf Mica, dezenter Abstand unter der Topbar (OneNote-Stil). */
export const moduleShellClass =
  'chronell-module-shell flex min-h-0 flex-1 overflow-hidden'

/** VerticalSplitter-Variante zwischen Nav und Inhalts-Pane (keine sichtbare Linie). */
export const moduleNavSplitterVariant = 'moduleNav' as const

/**
 * Ab Spalte 2: leicht andere Farbe, abgerundete linke obere Ecke (Fluent-Inset-Pane).
 * `flex-row` oder `flex-col` per className ergänzen.
 */
export const modulePaneStackClass =
  'chronell-module-pane-stack flex min-h-0 min-w-0 flex-1 overflow-hidden'

/** Erste Navigations-Spalte — transparent auf Mica (siehe `.module-nav-column`). */
export const moduleNavColumnClass = 'module-nav-column'

/** Scrollbarer Nav-Inhalt unter dem Mini-Monat (oben bündig mit Inhalts-Pane). */
export const moduleNavColumnScrollClass =
  'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-0'

/** Einheitliche Innenabstände in scrollbaren Nav-Inhalten (ohne Mini-Monat). */
export const moduleNavColumnInsetClass = 'space-y-4 px-3 pb-4 pt-0'

/**
 * Mini-Monat in Modul-Nav-Spalten (Kalender, Aufgaben, Notizen): oben bündig mit Spalte 2.
 */
export const moduleNavColumnMiniMonthShellClass =
  'shrink-0 border-b border-border px-3 pb-4 pt-0'

/** Abstand zwischen Kalenderkarte und optionalem Footer (z. B. Datumsfilter). */
export const moduleNavColumnMiniMonthFooterClass = 'mt-3'

/** Scrollbarer Inhalt unter dem Mini-Monat. */
export const moduleNavColumnScrollBodyClass =
  'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4'

/** Vertikaler Abstand zwischen Blöcken im Scroll-Inhalt (Kalender-Listen, …). */
export const moduleNavColumnScrollBodyStackClass = 'space-y-4'

/** @deprecated Nur Kompatibilität — Inhalt in {@link moduleNavColumnMiniMonthShellClass}. */
export const moduleNavColumnMiniMonthSectionClass = 'w-full'

export function moduleNavColumnClassNames(...extra: (string | false | null | undefined)[]): string {
  return cn(moduleNavColumnClass, ...extra)
}

export function modulePaneStackClassNames(...extra: (string | false | null | undefined)[]): string {
  return cn(modulePaneStackClass, ...extra)
}
