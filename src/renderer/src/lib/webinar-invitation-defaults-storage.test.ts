import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readWebinarInvitationDefaults,
  saveWebinarInvitationDefaults,
  upgradeWebinarLayoutTemplateHtml,
  type WebinarInvitationDefaults
} from '@/lib/webinar-invitation-defaults-storage'
import {
  readWebinarInvitationLayoutTemplates,
  WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
} from '@/lib/webinar-invitation-layout-templates-storage'
import { WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION } from '@/lib/webinar-invitation-layout-template'

const DEFAULTS_KEY = 'mailclient.webinarInvitationDefaults.v3'
const LAYOUTS_KEY = 'mailclient.webinarInvitationLayoutTemplates.v1'

describe('upgradeWebinarLayoutTemplateHtml', () => {
  it('keeps custom layout instead of clearing on version bump', () => {
    const custom =
      '<div style="overflow:hidden"><p>{{greetingBlock}}</p>{{titleBlock}}{{scheduleBlock}}{{teamsBlock}}</div>'
    const upgraded = upgradeWebinarLayoutTemplateHtml(custom, 3)
    expect(upgraded).toBeTruthy()
    expect(upgraded).toContain('{{greetingBlock}}')
    expect(upgraded).toContain('{{titleBlock}}')
    expect(upgraded).not.toMatch(/overflow\s*:\s*hidden/i)
  })

  it('returns null for empty input', () => {
    expect(upgradeWebinarLayoutTemplateHtml(null, 1)).toBeNull()
    expect(upgradeWebinarLayoutTemplateHtml('   ', 1)).toBeNull()
  })
})

describe('webinar invitation defaults + layout catalog', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    const localStorageMock = {
      getItem(key: string): string | null {
        return store[key] ?? null
      },
      setItem(key: string, value: string): void {
        store[key] = value
      },
      removeItem(key: string): void {
        delete store[key]
      },
      clear(): void {
        for (const key of Object.keys(store)) delete store[key]
      }
    }
    vi.stubGlobal('localStorage', localStorageMock)
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      dispatchEvent: vi.fn()
    })
  })

  it('persists default layout template id and theme prefs', () => {
    const next: WebinarInvitationDefaults = {
      defaultSurveyUrl: '',
      defaultWebsiteUrl: '',
      defaultHeroImageSrc: null,
      surveyLabel: 'Umfrage ausfüllen',
      websiteLabel: 'Veranstaltungsseite',
      greetingHtml: null,
      tipsHtml: null,
      signOffHtml: null,
      signatureHtml: null,
      layoutHtmlTemplate: null,
      layoutTemplateVersion: 1,
      defaultLayoutTemplateId: WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
      defaultLayoutColor: 'blue',
      defaultLayoutMode: 'light'
    }
    saveWebinarInvitationDefaults(next)
    const stored = JSON.parse(localStorage.getItem(DEFAULTS_KEY)!) as WebinarInvitationDefaults
    expect(stored.layoutTemplateVersion).toBe(WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION)
    expect(stored.defaultLayoutColor).toBe('blue')
    expect(stored.defaultLayoutMode).toBe('light')
    expect(stored.layoutHtmlTemplate).toBeNull()

    const read = readWebinarInvitationDefaults()
    expect(read.defaultLayoutTemplateId).toBe(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID)
    expect(read.defaultLayoutColor).toBe('blue')
  })

  it('migrates legacy single layoutHtmlTemplate into catalog', () => {
    const custom =
      '<section style="overflow:hidden">Custom{{greetingBlock}}{{titleBlock}}{{scheduleBlock}}{{teamsBlock}}</section>'
    localStorage.setItem(
      DEFAULTS_KEY,
      JSON.stringify({
        layoutHtmlTemplate: custom,
        layoutTemplateVersion: 2
      })
    )
    const read = readWebinarInvitationDefaults()
    expect(read.layoutHtmlTemplate).toBeNull()
    const layouts = readWebinarInvitationLayoutTemplates()
    const user = layouts.find((t) => !t.builtin)
    expect(user?.layoutHtml).toContain('Custom')
    expect(user?.layoutHtml).not.toMatch(/overflow\s*:\s*hidden/i)
    expect(read.defaultLayoutTemplateId).toBe(user?.id)
    expect(localStorage.getItem(LAYOUTS_KEY)).toBeTruthy()
  })
})
