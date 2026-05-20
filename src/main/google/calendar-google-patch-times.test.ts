import { describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  loadConfig: vi.fn(async () => ({ calendarTimeZone: 'Europe/Berlin' }))
}))

vi.mock('./google-auth-client', () => ({
  getGoogleApis: vi.fn()
}))

describe('googlePatchEventTimes sendUpdates', () => {
  it('sendet Updates an Teilnehmer wenn notifyAttendees true ist', async () => {
    const patch = vi.fn(async () => ({ data: {} }))
    const { getGoogleApis } = await import('./google-auth-client')
    vi.mocked(getGoogleApis).mockResolvedValue({
      calendar: { events: { patch } }
    } as never)

    const { googlePatchEventTimes } = await import('./calendar-google')
    await googlePatchEventTimes('acc', 'primary', 'ev1', {
      startIso: '2026-05-20T10:00:00.000Z',
      endIso: '2026-05-20T11:00:00.000Z',
      isAllDay: false,
      notifyAttendees: true
    })

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUpdates: 'all'
      })
    )
  })

  it('sendet keine Updates ohne notifyAttendees', async () => {
    const patch = vi.fn(async () => ({ data: {} }))
    const { getGoogleApis } = await import('./google-auth-client')
    vi.mocked(getGoogleApis).mockResolvedValue({
      calendar: { events: { patch } }
    } as never)

    const { googlePatchEventTimes } = await import('./calendar-google')
    await googlePatchEventTimes('acc', 'primary', 'ev1', {
      startIso: '2026-05-20T10:00:00.000Z',
      endIso: '2026-05-20T11:00:00.000Z',
      isAllDay: false
    })

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUpdates: undefined
      })
    )
  })
})
