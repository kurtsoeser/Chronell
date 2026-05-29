import { describe, expect, it } from 'vitest'
import {
  buildFilesDriveUploadDestination,
  canSaveToCurrentExplorerPath
} from './drive-explorer-destination'

describe('drive-explorer-destination', () => {
  it('allows myfiles root', () => {
    expect(canSaveToCurrentExplorerPath('myfiles', [])).toBe(true)
    const dest = buildFilesDriveUploadDestination('ms:1', 'myfiles', [])
    expect(dest.folderLabel).toBe('Meine Dateien')
    expect(dest.folderId).toBeNull()
  })

  it('disallows recent', () => {
    expect(canSaveToCurrentExplorerPath('recent', [])).toBe(false)
  })

  it('resolves sharepoint folder', () => {
    const crumbs = [
      { id: null, name: 'Team', siteId: 'site-1', driveId: null },
      { id: 'folder-a', name: 'Docs', driveId: 'drive-1', siteId: null }
    ]
    expect(canSaveToCurrentExplorerPath('sharepoint', crumbs)).toBe(true)
    const dest = buildFilesDriveUploadDestination('ms:1', 'sharepoint', crumbs)
    expect(dest.folderDriveId).toBe('drive-1')
    expect(dest.folderId).toBe('folder-a')
    expect(dest.siteId).toBe('site-1')
  })
})
