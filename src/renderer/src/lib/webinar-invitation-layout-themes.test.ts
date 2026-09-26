import { describe, expect, it } from 'vitest'
import {
  applyWebinarLayoutThemeColors,
  makeWebinarLayoutThemeId,
  WEBINAR_LAYOUT_DARK_SURFACES,
  WEBINAR_LAYOUT_LIGHT_SURFACES,
  WEBINAR_LAYOUT_THEME_ACCENTS,
  webinarLayoutThemeParts
} from '@/lib/webinar-invitation-layout-themes'
import { buildWebinarInvitationHtml } from '@/lib/build-webinar-invitation-html'

describe('webinar layout themes', () => {
  it('recolors gold accents to other colors including purple/red/gray', () => {
    const sample = `color:${WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent};border:${WEBINAR_LAYOUT_THEME_ACCENTS.gold.accentDark}`
    for (const color of ['blue', 'green', 'purple', 'red', 'gray'] as const) {
      const out = applyWebinarLayoutThemeColors(sample, color)
      expect(out).toContain(WEBINAR_LAYOUT_THEME_ACCENTS[color].accent)
      expect(out).toContain(WEBINAR_LAYOUT_THEME_ACCENTS[color].accentDark)
      expect(out).not.toContain(WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent)
    }
  })

  it('builds invitation html with blue accent instead of gold', () => {
    const gold = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: 'Umfrage',
      websiteUrl: '',
      websiteLabel: 'Web',
      scheduleLabel: 'Montag | 10:00 – 11:00',
      layoutTheme: 'gold'
    })
    const blue = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: 'Umfrage',
      websiteUrl: '',
      websiteLabel: 'Web',
      scheduleLabel: 'Montag | 10:00 – 11:00',
      layoutTheme: 'blue'
    })
    expect(gold).toContain(WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent)
    expect(blue).toContain(WEBINAR_LAYOUT_THEME_ACCENTS.blue.accent)
    expect(blue).not.toContain(WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent)
    expect(blue).toContain('#kurtrocks')
  })

  it('builds light variants with light surfaces and accent color', () => {
    const lightGold = buildWebinarInvitationHtml({
      title: 'Hell',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: 'Umfrage',
      websiteUrl: '',
      websiteLabel: 'Web',
      scheduleLabel: null,
      layoutTheme: 'gold-light'
    })
    expect(lightGold).toContain(WEBINAR_LAYOUT_LIGHT_SURFACES.outer)
    expect(lightGold).toContain(WEBINAR_LAYOUT_LIGHT_SURFACES.text)
    expect(lightGold).not.toContain(WEBINAR_LAYOUT_DARK_SURFACES.outer)
    expect(lightGold).toContain(WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent)

    const lightBlue = buildWebinarInvitationHtml({
      title: 'Hell Blau',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: 'Umfrage',
      websiteUrl: '',
      websiteLabel: 'Web',
      scheduleLabel: null,
      layoutTheme: 'blue-light'
    })
    expect(lightBlue).toContain(WEBINAR_LAYOUT_LIGHT_SURFACES.outer)
    expect(lightBlue).toContain(WEBINAR_LAYOUT_THEME_ACCENTS.blue.accent)
    expect(lightBlue).toContain(WEBINAR_LAYOUT_LIGHT_SURFACES.teamsPanel)
    expect(lightBlue).not.toContain(WEBINAR_LAYOUT_DARK_SURFACES.teamsPanel)
  })

  it('parses theme id into color and mode', () => {
    expect(webinarLayoutThemeParts('gold')).toEqual({ color: 'gold', mode: 'dark' })
    expect(webinarLayoutThemeParts('blue-light')).toEqual({ color: 'blue', mode: 'light' })
    expect(makeWebinarLayoutThemeId('green', 'light')).toBe('green-light')
    expect(makeWebinarLayoutThemeId('green', 'dark')).toBe('green')
  })
})
