import type { ComposeEditorTheme } from '@/stores/compose-editor-theme'
import type { Editor } from '@tiptap/react'
import { resolveComposeFontFamilyValue } from '@/lib/compose-font-families'
import { composeFontSizePtOptionValue } from '@/lib/compose-font-sizes'
import {
  readComposeSettingsPrefs,
  type ComposeSettingsPrefsV1
} from '@/lib/compose-settings-prefs'

export const COMPOSE_EDITOR_DARK_TEXT_COLOR = '#ffffff'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function isComposeBodyEffectivelyEmpty(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed) return true
  const stripped = trimmed
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
  return stripped.length === 0
}

export function resolveComposeEditorTextColor(
  theme: ComposeEditorTheme,
  prefs: ComposeSettingsPrefsV1 = readComposeSettingsPrefs()
): string {
  return theme === 'dark' ? COMPOSE_EDITOR_DARK_TEXT_COLOR : prefs.defaultTextColor
}

export function buildDefaultComposeBodyHtml(
  prefs: ComposeSettingsPrefsV1 = readComposeSettingsPrefs(),
  theme: ComposeEditorTheme = 'light'
): string {
  const family = resolveComposeFontFamilyValue(prefs.defaultFontFamilyId)
  const size = composeFontSizePtOptionValue(prefs.defaultFontSizePt)
  const color = resolveComposeEditorTextColor(theme, prefs)
  return `<p><span style="font-family:${escapeHtmlAttr(family)};font-size:${escapeHtmlAttr(size)};color:${escapeHtmlAttr(color)}"><br></span></p>`
}

export function applyComposeDefaultTypingMarks(
  editor: Editor,
  prefs: ComposeSettingsPrefsV1 = readComposeSettingsPrefs(),
  theme: ComposeEditorTheme = 'light'
): void {
  if (editor.isDestroyed) return
  const family = resolveComposeFontFamilyValue(prefs.defaultFontFamilyId)
  const size = composeFontSizePtOptionValue(prefs.defaultFontSizePt)
  editor
    .chain()
    .setMark('textStyle', {
      fontFamily: family,
      fontSize: size,
      color: resolveComposeEditorTextColor(theme, prefs)
    })
    .run()
}

export function composeEditorSurfaceStyle(
  prefs: ComposeSettingsPrefsV1 = readComposeSettingsPrefs(),
  theme: ComposeEditorTheme = 'light'
): { fontFamily: string; fontSize: string; color: string; lineHeight: string } {
  return {
    fontFamily: resolveComposeFontFamilyValue(prefs.defaultFontFamilyId),
    fontSize: composeFontSizePtOptionValue(prefs.defaultFontSizePt),
    color: resolveComposeEditorTextColor(theme, prefs),
    lineHeight: '1.5'
  }
}
