import {
  COMPOSE_DEFAULT_FONT_FAMILY_ID,
  composeFontFamilyById,
  resolveComposeFontFamilyValue
} from '@/lib/compose-font-families'
import { COMPOSE_FONT_SIZES_PT, normalizeComposeFontSizePt } from '@/lib/compose-font-sizes'
import type { MailImportance } from '@shared/types'

const STORAGE_KEY = 'mailclient.compose.settingsPrefs.v1'

export const COMPOSE_SETTINGS_PREFS_CHANGED_EVENT = 'mailclient:compose-settings-prefs-changed'

export const COMPOSE_DEFAULT_TEXT_COLOR = '#0f172a'

export const COMPOSE_TEXT_COLOR_OPTIONS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: COMPOSE_DEFAULT_TEXT_COLOR, labelKey: 'settings.mailCompose.textColorStandard' },
  { value: '#ef4444', labelKey: 'settings.mailCompose.textColorRed' },
  { value: '#f97316', labelKey: 'settings.mailCompose.textColorOrange' },
  { value: '#22c55e', labelKey: 'settings.mailCompose.textColorGreen' },
  { value: '#3b82f6', labelKey: 'settings.mailCompose.textColorBlue' },
  { value: '#64748b', labelKey: 'settings.mailCompose.textColorGray' }
]

export interface ComposeSettingsPrefsV1 {
  defaultFontSizePt: number
  defaultFontFamilyId: string
  defaultTextColor: string
  defaultImportance: MailImportance
  requestReadReceiptByDefault: boolean
}

const DEFAULTS: ComposeSettingsPrefsV1 = {
  defaultFontSizePt: 11,
  defaultFontFamilyId: COMPOSE_DEFAULT_FONT_FAMILY_ID,
  defaultTextColor: COMPOSE_DEFAULT_TEXT_COLOR,
  defaultImportance: 'normal',
  requestReadReceiptByDefault: false
}

function normalizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const v = raw.trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback
}

function normalizeFontFamilyId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULTS.defaultFontFamilyId
  return composeFontFamilyById(raw.trim()) ? raw.trim() : DEFAULTS.defaultFontFamilyId
}

function normalizeImportance(raw: unknown): MailImportance {
  if (raw === 'high' || raw === 'low' || raw === 'normal') return raw
  return DEFAULTS.defaultImportance
}

function parsePrefs(raw: string): ComposeSettingsPrefsV1 {
  const parsed = JSON.parse(raw) as Partial<ComposeSettingsPrefsV1>
  return {
    defaultFontSizePt: normalizeComposeFontSizePt(parsed.defaultFontSizePt, DEFAULTS.defaultFontSizePt),
    defaultFontFamilyId: normalizeFontFamilyId(parsed.defaultFontFamilyId),
    defaultTextColor: normalizeHexColor(parsed.defaultTextColor, DEFAULTS.defaultTextColor),
    defaultImportance: normalizeImportance(parsed.defaultImportance),
    requestReadReceiptByDefault: parsed.requestReadReceiptByDefault === true
  }
}

export function readComposeSettingsPrefs(): ComposeSettingsPrefsV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return parsePrefs(raw)
  } catch {
    // ignore
  }
  return { ...DEFAULTS }
}

export function persistComposeSettingsPrefs(prefs: ComposeSettingsPrefsV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(COMPOSE_SETTINGS_PREFS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function patchComposeSettingsPrefs(patch: Partial<ComposeSettingsPrefsV1>): ComposeSettingsPrefsV1 {
  const next = { ...readComposeSettingsPrefs(), ...patch }
  persistComposeSettingsPrefs(next)
  return next
}

export function resetComposeSettingsPrefs(): ComposeSettingsPrefsV1 {
  persistComposeSettingsPrefs({ ...DEFAULTS })
  return { ...DEFAULTS }
}

export function composeSettingsFontSizeOptions(): readonly number[] {
  return COMPOSE_FONT_SIZES_PT
}

export function composeSettingsResolvedFontFamily(id: string): string {
  return resolveComposeFontFamilyValue(id)
}
