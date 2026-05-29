import { describe, expect, it } from 'vitest'
import type { MailFileIndexRow } from '@shared/files'
import { groupMailFileRows } from './files-mail-grouping'
import type { FilesMailGroupingLabels } from './files-mail-grouping'

const labels: FilesMailGroupingLabels = {
  noSender: '(No sender)',
  noExtension: '(No ext)',
  unknownDate: 'Unknown',
  sizeUnknown: 'Size ?',
  sizeTiny: 'Tiny',
  sizeSmall: 'Small',
  sizeMedium: 'Medium',
  sizeLarge: 'Large',
  letterOther: '#',
  fileTypeLabels: {
    pdf: 'PDF',
    image: 'Image',
    audio: 'Audio',
    video: 'Video',
    spreadsheet: 'Sheet',
    presentation: 'Pres',
    document: 'Doc',
    archive: 'Zip',
    code: 'Code',
    text: 'Text',
    generic: 'Other'
  }
}

function row(partial: Partial<MailFileIndexRow> & Pick<MailFileIndexRow, 'id' | 'name'>): MailFileIndexRow {
  return {
    messageId: 1,
    accountId: 'a1',
    remoteAttachmentId: 'r1',
    mime: null,
    size: 1000,
    receivedAt: '2026-05-28T12:00:00.000Z',
    subject: 'Test',
    fromAddr: 'a@b.com',
    elementType: 'email',
    ...partial
  }
}

describe('groupMailFileRows', () => {
  it('groups by extension', () => {
    const groups = groupMailFileRows(
      [row({ id: 1, name: 'a.pdf' }), row({ id: 2, name: 'b.jpg' })],
      'extension',
      { accountLabel: () => 'Acc', labels }
    )
    expect(groups.map((g) => g.label).sort()).toEqual(['.jpg', '.pdf'])
  })

  it('groups by file type kind', () => {
    const groups = groupMailFileRows([row({ id: 1, name: 'x.wav', mime: 'audio/wav' })], 'fileType', {
      accountLabel: () => 'Acc',
      labels
    })
    expect(groups[0]?.label).toBe('Audio')
  })
})
