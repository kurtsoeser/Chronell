import { cn } from '@/lib/utils'

/**
 * Erste Navigations-Spalte in Modulen (Mail-Ordner, Kalender, Kontakte, Aufgaben, Notizen).
 * Hintergrund immer `bg-sidebar` — hellere Karten (Mini-Monat) nutzen `bg-card` in MiniMonthGrid.
 */
export const moduleNavColumnClass =
  'flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground'

/** Scrollbarer Inhalt unter Kopfzeile / Mini-Monat. */
export const moduleNavColumnScrollClass = 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'

/** Einheitliche Innenabstände in scrollbaren Nav-Inhalten (ohne Mini-Monat). */
export const moduleNavColumnInsetClass = 'space-y-4 px-3 py-4'

/**
 * Fester Block unter der Modul-Kopfzeile: Mini-Monat mit einheitlichen Rändern
 * (Kalender-, Aufgaben-, Notizen-Modul).
 */
export const moduleNavColumnMiniMonthShellClass =
  'shrink-0 border-b border-border px-3 pb-4 pt-4'

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
