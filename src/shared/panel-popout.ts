/** Abgedockte UI-Panels als eigenes Electron-Fenster. */
export const PANEL_POPOUT_KINDS = [
  'mail-calendar',
  'calendar-zeitliste',
  'calendar-preview',
  'calendar-event',
  'connections-preview',
  'compose',
  /** Modul einer Zone in einer benutzerdefinierten Ansicht. */
  'custom-view-zone'
] as const

export type PanelPopoutKind = (typeof PANEL_POPOUT_KINDS)[number]

export type PanelPopoutKey = string

export interface PanelPopoutOpenInput {
  panel: PanelPopoutKind
  /** Eindeutige Instanz (z. B. Entwurf-ID, entityRefKey). Leer = Singleton pro Panel-Typ. */
  instanceKey?: string
  title?: string
  alwaysOnTop?: boolean
  /** Zusaetzliche Hash-Query-Parameter (ohne `panel`). */
  params?: Record<string, string>
  /** Wenn gesetzt: Payload vor `open` per `stashPayload` ablegen. */
  stashKey?: string
}

export interface PanelPopoutRef {
  panel: PanelPopoutKind
  instanceKey?: string
}

export interface PanelPopoutClosedPayload {
  panel: PanelPopoutKind
  instanceKey: string
}

export interface PanelPopoutStashInput {
  key: string
  payload: unknown
}

/** Anfrage, ein OS-Popout wieder in die Hauptansicht einzubinden. */
export interface PanelPopoutDockPayload {
  panel: PanelPopoutKind
  instanceKey: string
  stashKey?: string
  params?: Record<string, string>
}
