import { describe, expect, it } from 'vitest'
import { buildDriveUploadItemPath } from './drive-upload'

describe('buildDriveUploadItemPath', () => {
  it('builds myfiles root content path', () => {
    expect(
      buildDriveUploadItemPath(
        { accountId: 'ms:1', scope: 'myfiles', folderId: null, folderDriveId: null },
        'report.pdf',
        'content'
      )
    ).toBe('/me/drive/root:/report.pdf:/content')
  })

  it('builds shared drive folder path', () => {
    expect(
      buildDriveUploadItemPath(
        {
          accountId: 'ms:1',
          scope: 'shared',
          folderId: 'item-1',
          folderDriveId: 'drive-9'
        },
        'data.xlsx',
        'uploadSession'
      )
    ).toBe('/drives/drive-9/items/item-1:/data.xlsx:/createUploadSession')
  })

  it('rejects recent scope', () => {
    expect(() =>
      buildDriveUploadItemPath(
        { accountId: 'ms:1', scope: 'recent', folderId: null, folderDriveId: null },
        'a.txt',
        'content'
      )
    ).toThrow()
  })
})
