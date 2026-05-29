import { describe, expect, it } from 'vitest'
import { driveExplorerCrumbsMatch } from './drive-explorer-favorites-nav'

describe('driveExplorerCrumbsMatch', () => {
  it('matches identical myfiles paths', () => {
    const crumbs = [{ id: 'f1', name: 'Docs', driveId: 'd1' }]
    expect(driveExplorerCrumbsMatch('myfiles', crumbs, 'myfiles', crumbs)).toBe(true)
  })

  it('rejects different scopes', () => {
    expect(driveExplorerCrumbsMatch('myfiles', [], 'shared', [])).toBe(false)
  })

  it('treats sharepoint library roots as equal when ids differ only by empty vs drive id', () => {
    const a = [{ id: null, name: 'Library', driveId: 'drive-1', siteId: null }]
    const b = [{ id: 'drive-1', name: 'Library', driveId: 'drive-1', siteId: null }]
    expect(driveExplorerCrumbsMatch('sharepoint', a, 'sharepoint', b)).toBe(true)
  })
})
