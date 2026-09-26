import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyWebinarInvitationLayoutTemplate,
  duplicateWebinarInvitationLayoutTemplate,
  getWebinarInvitationLayoutTemplateById,
  readWebinarInvitationLayoutTemplates,
  removeWebinarInvitationLayoutTemplate,
  resolveWebinarLayoutTemplateHtml,
  saveWebinarInvitationLayoutTemplate,
  WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
} from '@/lib/webinar-invitation-layout-templates-storage'

describe('webinar invitation layout templates catalog', () => {
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

  it('always includes builtin default', () => {
    const all = readWebinarInvitationLayoutTemplates()
    expect(all[0]?.id).toBe(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID)
    expect(all[0]?.builtin).toBe(true)
    expect(resolveWebinarLayoutTemplateHtml(all[0])).toContain('{{teamsBlock}}')
  })

  it('saves duplicates and refuses deleting builtin', () => {
    const created = createEmptyWebinarInvitationLayoutTemplate('Test A')
    saveWebinarInvitationLayoutTemplate(created)
    const copy = duplicateWebinarInvitationLayoutTemplate(created, 'Test B')
    saveWebinarInvitationLayoutTemplate(copy)
    expect(readWebinarInvitationLayoutTemplates()).toHaveLength(3)

    removeWebinarInvitationLayoutTemplate(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID)
    expect(getWebinarInvitationLayoutTemplateById(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID).builtin).toBe(
      true
    )

    removeWebinarInvitationLayoutTemplate(created.id)
    expect(readWebinarInvitationLayoutTemplates().map((t) => t.id)).toEqual([
      WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
      copy.id
    ])
  })
})
