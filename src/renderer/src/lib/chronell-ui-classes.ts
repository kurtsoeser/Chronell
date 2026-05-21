/** Gemeinsame Fluent/Chronell-Oberflaechen-Klassen (siehe chronell-tokens.css). */

export const chronellSurfaceFlatClass = 'chronell-surface-flat'

export const chronellModuleShellClass = 'chronell-module-shell'

export const chronellModulePaneStackClass = 'chronell-module-pane-stack'

export const chronellSurfacePanelClass = 'chronell-surface rounded-xl text-popover-foreground'

export const chronellPromptCardClass = 'chronell-prompt-card'

export const chronellAcrylicPopoverClass =
  'chronell-acrylic-popover glass-animate-in text-popover-foreground'

export const chronellAcrylicPopoverScrollClass =
  'chronell-acrylic-popover glass-animate-in overflow-y-auto text-popover-foreground'

/** Kleine Tooltips / Hover-Karten */
export const chronellAcrylicTooltipClass =
  'chronell-acrylic-popover rounded-md px-2.5 py-1.5 text-popover-foreground'

/** Notiz/Kontext in Vorschau: nur feine Trennlinien, keine hellen Kästen. */
export const entityContextDividerClass = 'border-white/[0.04] dark:border-white/[0.04]'

export const entityContextSectionBgClass = 'bg-secondary/[0.03]'

export const entityContextSplitterClass =
  'bg-white/[0.04] hover:bg-primary/20 dark:bg-white/[0.04] dark:hover:bg-primary/25'

/** Metadaten-Block in Kalender-/Aufgaben-Vorschau (Kalender, Ort, Organisator …). */
export const previewDetailPanelClass =
  'divide-y divide-white/[0.04] rounded-lg border border-white/[0.04] bg-secondary/[0.03] dark:divide-white/[0.04] dark:border-white/[0.04]'

/** Horizontale Trenner in Vorschau-Spalten (z. B. vor Beschreibung). */
export const previewSectionDividerClass =
  'border-white/[0.04] dark:border-white/[0.04]'

/** Notiz/Kontext unter der Mail-Vorschau (Höhe per Splitter, siehe ReadingPane). */
export const mailPreviewContextPanelClass =
  'flex min-h-0 shrink-0 flex-col overflow-hidden border-t-0 bg-secondary/[0.02]'

/** Einzelne Nachricht in der Konversationsvorschau (Kachel, Abstand statt Trennstrich). */
export const mailConversationMessageTileClass =
  'overflow-hidden rounded-xl border border-black/[0.06] bg-card/90 shadow-sm dark:border-white/[0.07] dark:bg-secondary/35'

export const mailConversationStackClass = 'flex flex-col gap-2 p-2'

/** Scroll-Bereich unter An/Betreff mit Abstand zur Mail-Kachel (wie Konversations-Stack). */
export const composeMailBodyShellClass =
  'compose-mail-body-shell flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2'

/** Mail-Text / Signatur im Composer (weiße Kachel, rounded-xl). */
export const composeMailBodyTileClass = 'compose-mail-body-tile'

/** Zeitliste / chronologische Listen: Zeilen- und Gruppentrenner. */
export const listDivideClass =
  'divide-y divide-white/[0.04] dark:divide-white/[0.04]'

export const listSubtleBorderClass =
  'border-white/[0.04] dark:border-white/[0.04]'

/** Einstellungen: Gruppierung per Hintergrund (ohne Kachelrahmen). */
export const settingsSectionClass = 'rounded-md bg-background/60'

/** Einstellungen/Dialoge: Eintrag-Kachel (z. B. verbundenes Konto). */
export const settingsTileClass = 'rounded-md bg-background/60'

/** Einstellungen: dezenter Rand fuer Steuerelemente. */
export const settingsControlBorderClass =
  'border-white/[0.06] dark:border-white/[0.06]'
