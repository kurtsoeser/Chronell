import { describe, expect, it } from 'vitest'
import {
  CUSTOM_VIEW_DEFAULT_ICON_ID,
  normalizeCustomViewIconId,
  resolveCustomViewTabIcon
} from '@/lib/custom-view-tab-icon'

describe('custom-view-tab-icon', () => {
  it('akzeptiert Katalog-IDs und lehnt calendar ab', () => {
    expect(normalizeCustomViewIconId('star')).toBe('star')
    expect(normalizeCustomViewIconId('layout-dashboard')).toBe('layout-dashboard')
    expect(normalizeCustomViewIconId('calendar')).toBeUndefined()
    expect(normalizeCustomViewIconId('')).toBeUndefined()
  })

  it('löst gespeicherte IDs zu Lucide-Komponenten auf', () => {
    const Icon = resolveCustomViewTabIcon('star')
    expect(Icon).toBeTruthy()
    expect(resolveCustomViewTabIcon(undefined)).toBeTruthy()
    expect(resolveCustomViewTabIcon(CUSTOM_VIEW_DEFAULT_ICON_ID)).toBeTruthy()
  })
})
