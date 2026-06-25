import { describe, expect, it } from 'vitest'
import {
  buildDefaultComposeBodyHtml,
  isComposeBodyEffectivelyEmpty
} from '@/lib/compose-default-body'
import type { ComposeSettingsPrefsV1 } from '@/lib/compose-settings-prefs'
import { COMPOSE_DEFAULT_TEXT_COLOR } from '@/lib/compose-settings-prefs'

const SAMPLE_PREFS: ComposeSettingsPrefsV1 = {
  defaultFontSizePt: 12,
  defaultFontFamilyId: 'arial',
  defaultTextColor: COMPOSE_DEFAULT_TEXT_COLOR,
  defaultImportance: 'normal',
  requestReadReceiptByDefault: false
}

describe('isComposeBodyEffectivelyEmpty', () => {
  it('erkennt leere und Platzhalter-Inhalte', () => {
    expect(isComposeBodyEffectivelyEmpty('')).toBe(true)
    expect(isComposeBodyEffectivelyEmpty('<p></p>')).toBe(true)
    expect(isComposeBodyEffectivelyEmpty('<p><br></p>')).toBe(true)
    expect(isComposeBodyEffectivelyEmpty('<p>&nbsp;</p>')).toBe(true)
    expect(isComposeBodyEffectivelyEmpty('<p>Hallo</p>')).toBe(false)
  })
})

describe('buildDefaultComposeBodyHtml', () => {
  it('setzt Schriftart, Größe und Farbe als Inline-Stil', () => {
    const html = buildDefaultComposeBodyHtml(SAMPLE_PREFS)
    expect(html).toContain('font-family:Arial, Helvetica, sans-serif')
    expect(html).toContain('font-size:12pt')
    expect(html).toContain(`color:${COMPOSE_DEFAULT_TEXT_COLOR}`)
  })
})
