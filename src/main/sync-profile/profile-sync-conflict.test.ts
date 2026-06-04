import { describe, expect, it } from 'vitest'
import { computeConflictPending, computeConflictRemoteNewer } from './profile-sync-conflict'

describe('computeConflictPending', () => {
  it('kein Konflikt nach Upload wenn Cloud-Stand dem letzten Push entspricht', () => {
    const t = 1_700_000_000_000
    expect(
      computeConflictPending(t, t - 60_000, t, false, true)
    ).toBe(false)
  })

  it('kein Konflikt wenn Cloud neuer als Pull aber keine lokalen Änderungen', () => {
    expect(
      computeConflictPending(2000, 1000, 2000, false, true)
    ).toBe(false)
  })

  it('Konflikt bei lokalen Änderungen und neuerem Cloud-Stand', () => {
    expect(
      computeConflictPending(2000, 1000, 1500, true, true)
    ).toBe(true)
  })

  it('Konflikt wenn lokal geändert und Cloud nach letztem Push aktualisiert', () => {
    expect(
      computeConflictPending(1500, 2000, 1000, true, true)
    ).toBe(true)
  })

  it('kein Konflikt bei nur lokalen Änderungen und unveränderter Cloud', () => {
    expect(
      computeConflictPending(1000, 2000, 1500, true, true)
    ).toBe(false)
  })
})

describe('computeConflictRemoteNewer', () => {
  it('meldet neueren Cloud-Stand gegenüber Pull und Push', () => {
    expect(computeConflictRemoteNewer(3000, 1000, 2000)).toBe(true)
  })

  it('kein Hinweis wenn Cloud dem letzten Push entspricht', () => {
    const t = 5000
    expect(computeConflictRemoteNewer(t, 1000, t)).toBe(false)
  })
})
