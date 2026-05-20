/**
 * Microsoft Graph: calendar.color (calendarColor) und calendar.hexColor.
 * hexColor ist die in Outlook/365 gesetzte Farbe; fehlt sie, nutzen wir die Enum-Zuordnung.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/calendar
 */

/** Typische Outlook-Web-Farben fuer calendarColor (ohne explizites hexColor). */
const CALENDAR_COLOR_ENUM_TO_HEX: Record<string, string> = {
  lightBlue: '#4A86E8',
  lightGreen: '#0F9D58',
  lightOrange: '#F4511E',
  lightGray: '#9E9E9E',
  lightYellow: '#F4B400',
  lightTeal: '#0097A7',
  lightPink: '#E91E63',
  lightBrown: '#795548',
  lightRed: '#DB4437',
  lightMagenta: '#AB47BC',
  auto: '',
  maxColor: ''
}

/** Graph `calendar.color` (PATCH): nur von Microsoft dokumentierte `calendarColor`-Werte. */
export const GRAPH_CALENDAR_COLOR_PRESET_IDS = [
  'auto',
  'lightBlue',
  'lightGreen',
  'lightOrange',
  'lightGray',
  'lightYellow',
  'lightTeal',
  'lightPink',
  'lightBrown',
  'lightRed'
] as const

export type GraphCalendarColorPresetId = (typeof GRAPH_CALENDAR_COLOR_PRESET_IDS)[number]

export type CalendarExtendedColorPreset = {
  id: string
  hex: string
  /** Naechstes Graph-`calendarColor` fuer Outlook-Sync (PATCH). */
  outlookSync: Exclude<GraphCalendarColorPresetId, 'auto'>
}

/** Zusaetzliche Farben (Anzeige per Hex-Override; Outlook erhaelt naechstes Standard-Preset). */
export const CALENDAR_EXTENDED_COLOR_PRESETS: readonly CalendarExtendedColorPreset[] = [
  { id: 'extIndigo', hex: '#5C6BC0', outlookSync: 'lightBlue' },
  { id: 'extViolet', hex: '#7E57C2', outlookSync: 'lightPink' },
  { id: 'extPurple', hex: '#8E24AA', outlookSync: 'lightPink' },
  { id: 'extMagenta', hex: '#C2185B', outlookSync: 'lightPink' },
  { id: 'extCoral', hex: '#FF7043', outlookSync: 'lightOrange' },
  { id: 'extAmber', hex: '#FFB300', outlookSync: 'lightYellow' },
  { id: 'extLime', hex: '#AFB42B', outlookSync: 'lightGreen' },
  { id: 'extMint', hex: '#26A69A', outlookSync: 'lightTeal' },
  { id: 'extCyan', hex: '#00ACC1', outlookSync: 'lightTeal' },
  { id: 'extSky', hex: '#29B6F6', outlookSync: 'lightBlue' },
  { id: 'extNavy', hex: '#1565C0', outlookSync: 'lightBlue' },
  { id: 'extWine', hex: '#AD1457', outlookSync: 'lightRed' },
  { id: 'extCharcoal', hex: '#546E7A', outlookSync: 'lightGray' },
  { id: 'extOlive', hex: '#827717', outlookSync: 'lightBrown' }
]

const EXTENDED_BY_ID = new Map(CALENDAR_EXTENDED_COLOR_PRESETS.map((p) => [p.id, p]))

export function normalizeGraphHexColor(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t.slice(0, 7)
  if (/^[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.slice(0, 6)}`
  if (/^[0-9A-Fa-f]{3}$/i.test(t)) {
    const x = t.slice(0, 3)
    return `#${x[0]}${x[0]}${x[1]}${x[1]}${x[2]}${x[2]}`.toUpperCase()
  }
  return null
}

export function graphCalendarColorToDisplayHex(
  hexColor: string | null | undefined,
  colorEnum: string | null | undefined
): string | null {
  const fromHex = normalizeGraphHexColor(hexColor)
  if (fromHex) return fromHex
  const key = (colorEnum ?? 'auto').trim()
  if (!key || key === 'auto' || key === 'maxColor') return null
  return CALENDAR_COLOR_ENUM_TO_HEX[key] ?? null
}

/** Einheitliche Anzeigefarbe fuer Sidebar, Termine und Farbmenue. */
export function resolveCalendarDisplayHex(cal: {
  hexColor?: string | null
  color?: string | null
  displayColorOverrideHex?: string | null
}): string | null {
  const override = normalizeGraphHexColor(cal.displayColorOverrideHex)
  if (override) return override
  return graphCalendarColorToDisplayHex(cal.hexColor, cal.color)
}

export const CALENDAR_EXTENDED_COLOR_PRESET_IDS = CALENDAR_EXTENDED_COLOR_PRESETS.map(
  (p) => p.id
) as readonly string[]

/** Alle Eintraege im Kalender-Farbmenue (Outlook-Standard + erweitert). */
export const CALENDAR_COLOR_MENU_PRESET_IDS = [
  ...GRAPH_CALENDAR_COLOR_PRESET_IDS,
  ...CALENDAR_EXTENDED_COLOR_PRESETS.map((p) => p.id)
] as const

export type CalendarColorMenuPresetId = (typeof CALENDAR_COLOR_MENU_PRESET_IDS)[number]

export function isGraphCalendarColorPreset(value: string): value is GraphCalendarColorPresetId {
  return (GRAPH_CALENDAR_COLOR_PRESET_IDS as readonly string[]).includes(value)
}

export function isCalendarExtendedColorPreset(value: string): boolean {
  return EXTENDED_BY_ID.has(value)
}

export function isCalendarColorMenuPreset(value: string): value is CalendarColorMenuPresetId {
  return (CALENDAR_COLOR_MENU_PRESET_IDS as readonly string[]).includes(value)
}

export function calendarMenuPresetDisplayHex(presetId: string): string | null {
  if (presetId === 'auto') return null
  if (isGraphCalendarColorPreset(presetId)) {
    return graphCalendarColorToDisplayHex(null, presetId)
  }
  return EXTENDED_BY_ID.get(presetId)?.hex ?? null
}

/** Graph-Enum fuer PATCH bei erweiterten Farben (Outlook-Naeherung). */
export function calendarMenuPresetOutlookSyncColor(presetId: string): GraphCalendarColorPresetId | null {
  if (presetId === 'auto') return 'auto'
  if (isGraphCalendarColorPreset(presetId)) return presetId
  return EXTENDED_BY_ID.get(presetId)?.outlookSync ?? null
}

export function findExtendedPresetByHex(hex: string): string | null {
  const norm = normalizeGraphHexColor(hex)
  if (!norm) return null
  const upper = norm.toUpperCase()
  for (const p of CALENDAR_EXTENDED_COLOR_PRESETS) {
    if (p.hex.toUpperCase() === upper) return p.id
  }
  return null
}

/** Aktuell gewaehlter Menue-Eintrag fuer Haeckchen in der Farbauswahl. */
export function resolveCalendarMenuPresetId(cal: {
  hexColor?: string | null
  color?: string | null
  displayColorOverrideHex?: string | null
}): string | null {
  const override = normalizeGraphHexColor(cal.displayColorOverrideHex)
  if (override) {
    const ext = findExtendedPresetByHex(override)
    if (ext) return ext
    const graphMatch = GRAPH_CALENDAR_COLOR_PRESET_IDS.find(
      (id) => id !== 'auto' && graphCalendarColorToDisplayHex(null, id)?.toUpperCase() === override.toUpperCase()
    )
    if (graphMatch) return graphMatch
    return null
  }
  const raw = (cal.color ?? 'auto').trim().toLowerCase()
  if (!raw || raw === 'auto') return 'auto'
  const found = GRAPH_CALENDAR_COLOR_PRESET_IDS.find((id) => id.toLowerCase() === raw)
  return found ?? null
}

export const GRAPH_CALENDAR_COLOR_PRESET_LABELS_DE: Record<GraphCalendarColorPresetId, string> = {
  auto: 'Automatisch',
  lightBlue: 'Hellblau',
  lightGreen: 'Hellgruen',
  lightOrange: 'Hellorange',
  lightGray: 'Hellgrau',
  lightYellow: 'Hellgelb',
  lightTeal: 'Hellpetrol',
  lightPink: 'Hellrosa',
  lightBrown: 'Hellbraun',
  lightRed: 'Hellrot'
}
