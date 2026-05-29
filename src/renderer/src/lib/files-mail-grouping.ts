import type { FilesMailGroupBy, MailFileIndexRow } from '@shared/files'
import { dateBucketFor } from '@/lib/mail-list-arrange'
import { resolveMailFileVisualKind, mailFileVisualKindLabelKey } from '@/lib/mail-file-display'

export interface MailFileGroupBlock {
  key: string
  label: string
  sortKey: string | number
  rows: MailFileIndexRow[]
}

export interface FilesMailGroupingLabels {
  noSender: string
  noExtension: string
  unknownDate: string
  sizeUnknown: string
  sizeTiny: string
  sizeSmall: string
  sizeMedium: string
  sizeLarge: string
  letterOther: string
  fileTypeLabels: Record<ReturnType<typeof resolveMailFileVisualKind>, string>
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function senderDisplay(fromAddr: string | null, noSender: string): string {
  const raw = fromAddr?.trim()
  if (!raw) return noSender
  const angle = raw.match(/^([^<]+)</)
  if (angle?.[1]?.trim()) return angle[1].trim()
  const email = raw.match(/<([^>]+)>/)?.[1]?.trim() ?? raw
  return email || noSender
}

function firstLetterBucket(text: string, letterOther: string): { key: string; label: string } {
  const t = text.trim()
  if (!t) return { key: '#', label: letterOther }
  const ch = t[0]!.toUpperCase()
  if (ch >= 'A' && ch <= 'Z') return { key: ch, label: ch }
  if (ch >= '0' && ch <= '9') return { key: '0-9', label: '0–9' }
  return { key: '#', label: letterOther }
}

function sizeBucket(
  size: number | null,
  labels: Pick<
    FilesMailGroupingLabels,
    'sizeUnknown' | 'sizeTiny' | 'sizeSmall' | 'sizeMedium' | 'sizeLarge'
  >
): { key: string; label: string; sortKey: number } {
  if (size == null || size < 0) return { key: 'unknown', label: labels.sizeUnknown, sortKey: 0 }
  if (size < 100 * 1024) return { key: 'tiny', label: labels.sizeTiny, sortKey: 1 }
  if (size < 1024 * 1024) return { key: 'small', label: labels.sizeSmall, sortKey: 2 }
  if (size < 10 * 1024 * 1024) return { key: 'medium', label: labels.sizeMedium, sortKey: 3 }
  return { key: 'large', label: labels.sizeLarge, sortKey: 4 }
}

const DATE_BUCKET_RANK: Record<string, number> = {
  today: 0,
  yesterday: 1,
  thisWeek: 2,
  thisMonth: 3,
  unknown: 9998
}

function dateSortKey(key: string): number {
  const fixed = DATE_BUCKET_RANK[key]
  if (fixed != null) return fixed
  const m = /^(\d{4})-(\d{1,2})$/.exec(key)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    return 100 + (9999 - year) * 12 + (11 - month)
  }
  return 5000
}

export function groupMailFileRows(
  rows: MailFileIndexRow[],
  groupBy: FilesMailGroupBy,
  ctx: {
    accountLabel: (accountId: string) => string
    labels: FilesMailGroupingLabels
  }
): MailFileGroupBlock[] {
  const map = new Map<string, MailFileGroupBlock>()

  for (const row of rows) {
    let key: string
    let label: string
    let sortKey: string | number

    switch (groupBy) {
      case 'date': {
        const b = dateBucketFor(row.receivedAt)
        key = b.key
        label = b.label
        sortKey = dateSortKey(b.key)
        break
      }
      case 'fileType': {
        const kind = resolveMailFileVisualKind(row.mime, row.name)
        key = kind
        label = ctx.labels.fileTypeLabels[kind]
        sortKey = label
        break
      }
      case 'size': {
        const b = sizeBucket(row.size, ctx.labels)
        key = b.key
        label = b.label
        sortKey = b.sortKey
        break
      }
      case 'nameLetter': {
        const b = firstLetterBucket(row.name, ctx.labels.letterOther)
        key = `name:${b.key}`
        label = b.label
        sortKey = b.key === '#' ? 'ZZZ' : b.key
        break
      }
      case 'subjectLetter': {
        const b = firstLetterBucket(row.subject || '', ctx.labels.letterOther)
        key = `subj:${b.key}`
        label = b.label
        sortKey = b.key === '#' ? 'ZZZ' : b.key
        break
      }
      case 'from': {
        label = senderDisplay(row.fromAddr, ctx.labels.noSender)
        key = `from:${label.toLowerCase()}`
        sortKey = label.toLowerCase()
        break
      }
      case 'account': {
        label = ctx.accountLabel(row.accountId)
        key = `acc:${row.accountId}`
        sortKey = label.toLowerCase()
        break
      }
      case 'extension': {
        const ext = extOf(row.name)
        if (!ext) {
          key = 'none'
          label = ctx.labels.noExtension
          sortKey = '~~~'
        } else {
          key = ext
          label = `.${ext}`
          sortKey = ext
        }
        break
      }
      default: {
        const b = dateBucketFor(row.receivedAt)
        key = b.key
        label = b.label
        sortKey = dateSortKey(b.key)
      }
    }

    let g = map.get(key)
    if (!g) {
      g = { key, label, sortKey, rows: [] }
      map.set(key, g)
    }
    g.rows.push(row)
  }

  return [...map.values()].sort((a, b) => {
    if (typeof a.sortKey === 'number' && typeof b.sortKey === 'number') {
      return a.sortKey - b.sortKey
    }
    return String(a.sortKey).localeCompare(String(b.sortKey), undefined, { sensitivity: 'base' })
  })
}

/** i18n-Schlüssel für Dateityp-Gruppenlabels. */
export function buildFilesMailGroupingLabels(
  t: (key: string) => string
): FilesMailGroupingLabels {
  const kinds = [
    'pdf',
    'image',
    'audio',
    'video',
    'spreadsheet',
    'presentation',
    'document',
    'archive',
    'code',
    'text',
    'generic'
  ] as const
  const fileTypeLabels = {} as FilesMailGroupingLabels['fileTypeLabels']
  for (const k of kinds) {
    fileTypeLabels[k] = t(mailFileVisualKindLabelKey(k))
  }
  return {
    noSender: t('files.grouping.noSender'),
    noExtension: t('files.grouping.noExtension'),
    unknownDate: t('files.grouping.unknownDate'),
    sizeUnknown: t('files.grouping.sizeUnknown'),
    sizeTiny: t('files.grouping.sizeTiny'),
    sizeSmall: t('files.grouping.sizeSmall'),
    sizeMedium: t('files.grouping.sizeMedium'),
    sizeLarge: t('files.grouping.sizeLarge'),
    letterOther: t('files.grouping.letterOther'),
    fileTypeLabels
  }
}
