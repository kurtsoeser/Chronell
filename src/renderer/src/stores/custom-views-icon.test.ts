// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { readCustomViews, CUSTOM_VIEWS_STORAGE_KEY } from '@/app/custom-views/custom-views-storage'
import { useCustomViewsStore } from '@/stores/custom-views'

const minimalZone = { type: 'leaf' as const, id: 'z1', panel: 'none' as const }

describe('useCustomViewsStore.setViewIcon', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCustomViewsStore.setState({
      views: [
        {
          id: 'view-a',
          name: 'Ansicht A',
          zoneRoot: minimalZone,
          createdAt: 1
        }
      ],
      topbarOrder: ['view-a'],
      activeViewId: 'view-a',
      editMode: false,
      selectedLeafId: null,
      editSnapshot: null,
      templatePickerOpen: false,
      wizardOpen: false,
      wizardDraft: null
    })
  })

  it('speichert iconId im Store und localStorage', () => {
    useCustomViewsStore.getState().setViewIcon('view-a', 'video')
    const state = useCustomViewsStore.getState()
    expect(state.views[0]?.iconId).toBe('video')

    const raw = window.localStorage.getItem(CUSTOM_VIEWS_STORAGE_KEY)
    expect(raw).toContain('"video"')
    expect(readCustomViews()[0]?.iconId).toBe('video')
  })

  it('überlebt Topbar-Sync nach notify ohne iconId zu verlieren', () => {
    useCustomViewsStore.getState().setViewIcon('view-a', 'briefcase')
    const fromLs = readCustomViews()
    useCustomViewsStore.setState({ views: fromLs, topbarOrder: ['view-a'] })
    expect(useCustomViewsStore.getState().views[0]?.iconId).toBe('briefcase')
  })

  it('schreibt iconId vor custom-views-changed (async persist)', async () => {
    const events: string[] = []
    const handler = (): void => {
      events.push(readCustomViews()[0]?.iconId ?? '')
    }
    window.addEventListener('mailclient:custom-views-changed', handler)
    useCustomViewsStore.getState().setViewIcon('view-a', 'star')
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('mailclient:custom-views-changed', handler)
    expect(events).toEqual(['star'])
    expect(readCustomViews()[0]?.iconId).toBe('star')
  })
})
