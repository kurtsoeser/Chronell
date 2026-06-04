// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_VIEWS_STORAGE_KEY,
  readCustomViews,
  writeCustomViews,
  type CustomViewDefinition
} from '@/app/custom-views/custom-views-storage'

const minimalZone = { type: 'leaf' as const, id: 'z1', panel: 'none' as const }

describe('custom-views-storage iconId', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persistiert iconId nach Schreiben und Lesen', () => {
    const views: CustomViewDefinition[] = [
      {
        id: 'view-test',
        name: 'Test',
        iconId: 'star',
        zoneRoot: minimalZone,
        createdAt: 1
      }
    ]
    writeCustomViews(views)
    const raw = window.localStorage.getItem(CUSTOM_VIEWS_STORAGE_KEY)
    expect(raw).toContain('"star"')
    const loaded = readCustomViews()
    expect(loaded[0]?.iconId).toBe('star')
  })

  it('setzt Standard-iconId wenn keines gespeichert war', () => {
    writeCustomViews([
      {
        id: 'view-old',
        name: 'Alt',
        zoneRoot: minimalZone,
        createdAt: 1
      }
    ])
    expect(readCustomViews()[0]?.iconId).toBe('layout-dashboard')
  })
})
