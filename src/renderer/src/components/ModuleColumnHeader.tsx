import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Zentrales Erscheinungsbild für Spalten- und Modulköpfe.
 *
 * - **Eine Zeile, 40px** (`h-10`): Posteingangs-Liste, Mail-Vorschau-Toolbar, Kalender-Dock, Vollpflicht-Module (Kontakte, Regeln, …).
 * - **Icons**: Lucide meist `moduleColumnHeaderIconGlyphClass` (3.5), Buttons **7×7**.
 * - **Primär/Sekundär-CTA**: `moduleColumnHeaderPrimarySmClass` / `moduleColumnHeaderOutlineSmClass`.
 *
 * Neue Modul-Header bitte hier anbinden statt eigener `py-3`/`h-11`/`h-12`-Varianten.
 */

/** Posteingang (`MailList`): eine Zeile mit unterem Rand. */
export const moduleColumnHeaderMailListRowClass =
  'chronell-column-header chronell-column-header--card flex h-10 min-h-0 shrink-0 items-center gap-2 px-2 text-xs'

/** Kalender-Dock / schmale Modulspalte: gleiche Höhe, Titel links, Aktionen rechts. */
export const moduleColumnHeaderDockBarRowClass =
  'chronell-column-header chronell-column-header--card flex h-10 w-full min-h-0 shrink-0 items-center justify-between gap-2 px-2 text-xs'

/** Mail-Lesevorschau: Aktionsleiste — fest 40px wie Posteingangs-Liste und Termine. */
export const moduleColumnHeaderReadingToolbarClass =
  'chronell-column-header chronell-column-header--card flex h-10 min-h-10 max-h-10 w-full shrink-0 items-center gap-0.5 overflow-hidden px-2 text-xs'

/**
 * Obere Leiste in Vollmodulen (Kontakte, Aufgaben-Hauptbereich, Regeln, Workflow, …).
 */
export const moduleColumnHeaderShellBarClass =
  'chronell-column-header chronell-column-header--card flex h-10 min-h-0 shrink-0 items-center justify-between gap-2 px-2 text-xs'

/** Kopfzeile innerhalb der Nav-Spalte (L1 Sidebar). */
export const moduleColumnHeaderNavShellBarClass =
  'chronell-column-header chronell-column-header--nav flex h-10 min-h-0 shrink-0 items-center justify-between gap-2 px-2 text-xs'

/** Zweite Zeile unter der Shell-Leiste (Suche, Filterchips, …). */
export const moduleColumnHeaderSubToolbarClass =
  'chronell-column-header chronell-column-header--card shrink-0 space-y-2 px-2 py-2 text-xs'

export const moduleColumnHeaderNavSubToolbarClass =
  'chronell-column-header chronell-column-header--nav shrink-0 space-y-2 px-2 py-2 text-xs'

export const moduleColumnHeaderTitleClass = 'min-w-0 shrink-0 font-semibold text-foreground'

export const moduleColumnHeaderUppercaseLabelClass =
  'min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

export const moduleColumnHeaderLabelWithIconClass =
  'flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

export const moduleColumnHeaderActionsClass = 'flex shrink-0 items-center gap-0.5'

/** Icon-only, ohne Rahmen (Schließen, Abdocken, …). */
export const moduleColumnHeaderIconButtonClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'

/** Lucide-Größe passend zu `moduleColumnHeaderIconButtonClass`. */
export const moduleColumnHeaderIconGlyphClass = 'h-3.5 w-3.5 shrink-0'

const toolbarToggleBase =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'

export function moduleColumnHeaderToolbarToggleClass(pressed: boolean): string {
  return cn(toolbarToggleBase, pressed && 'border-primary/40 bg-primary/10 text-foreground')
}

/** Kompakter Primärbutton (Neuer Kontakt, Notiz, …). */
export const moduleColumnHeaderPrimarySmClass =
  'inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:text-xs'

/** Kompakter Umrissbutton (Sync, Sekundäraktionen). */
export const moduleColumnHeaderOutlineSmClass =
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 sm:text-xs'

type ModuleColumnHeaderIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Nur bei `variant="toolbar"`: hervorgehobener Rahmen wie Panel-Toggle. */
  pressed?: boolean
  variant?: 'ghost' | 'toolbar'
}

export const ModuleColumnHeaderIconButton = forwardRef<
  HTMLButtonElement,
  ModuleColumnHeaderIconButtonProps
>(function ModuleColumnHeaderIconButton(
  { className, pressed, variant = 'ghost', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        variant === 'toolbar'
          ? moduleColumnHeaderToolbarToggleClass(!!pressed)
          : moduleColumnHeaderIconButtonClass,
        className
      )}
      {...props}
    />
  )
})

/** Optionaler Wrapper — z. B. Kalender-Sidebar mit zwei Textzeilen in `h-10`. */
export function ModuleColumnHeaderStackedTitle(props: {
  kicker: ReactNode
  title: ReactNode
  className?: string
}): JSX.Element {
  const { kicker, title, className } = props
  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5', className)}>
      <div className="truncate text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
        {kicker}
      </div>
      <div className="truncate font-semibold leading-tight text-foreground">{title}</div>
    </div>
  )
}
