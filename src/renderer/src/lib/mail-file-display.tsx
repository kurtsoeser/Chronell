import type { LucideIcon } from 'lucide-react'
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation
} from 'lucide-react'
import type { FilesMailCategory } from '@shared/attachment-category'
import { cn } from '@/lib/utils'

export type MailFileVisualKind =
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'spreadsheet'
  | 'presentation'
  | 'document'
  | 'archive'
  | 'code'
  | 'text'
  | 'generic'

const KIND_META: Record<
  MailFileVisualKind,
  { icon: LucideIcon; className: string; i18nKey: string }
> = {
  pdf: { icon: FileText, className: 'text-red-500 dark:text-red-400', i18nKey: 'files.fileType.pdf' },
  image: {
    icon: FileImage,
    className: 'text-sky-500 dark:text-sky-400',
    i18nKey: 'files.fileType.image'
  },
  audio: {
    icon: FileAudio,
    className: 'text-violet-500 dark:text-violet-400',
    i18nKey: 'files.fileType.audio'
  },
  video: {
    icon: FileVideo,
    className: 'text-fuchsia-500 dark:text-fuchsia-400',
    i18nKey: 'files.fileType.video'
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    className: 'text-emerald-600 dark:text-emerald-400',
    i18nKey: 'files.fileType.spreadsheet'
  },
  presentation: {
    icon: Presentation,
    className: 'text-orange-500 dark:text-orange-400',
    i18nKey: 'files.fileType.presentation'
  },
  document: {
    icon: FileText,
    className: 'text-blue-500 dark:text-blue-400',
    i18nKey: 'files.fileType.document'
  },
  archive: {
    icon: FileArchive,
    className: 'text-amber-600 dark:text-amber-400',
    i18nKey: 'files.fileType.archive'
  },
  code: {
    icon: FileCode,
    className: 'text-cyan-600 dark:text-cyan-400',
    i18nKey: 'files.fileType.code'
  },
  text: {
    icon: FileText,
    className: 'text-muted-foreground',
    i18nKey: 'files.fileType.text'
  },
  generic: { icon: File, className: 'text-muted-foreground', i18nKey: 'files.fileType.generic' }
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** Erkennung des Dateityps für Icon und Gruppierung. */
export function resolveMailFileVisualKind(mime: string | null, name: string): MailFileVisualKind {
  const m = (mime ?? '').toLowerCase()
  const ext = extOf(name)

  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'

  if (m.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|bmp|ico|heic|avif|tiff?)$/.test(ext)) {
    return 'image'
  }

  if (
    m.startsWith('audio/') ||
    /^(wav|mp3|m4a|aac|ogg|flac|wma|opus|aiff?)$/.test(ext)
  ) {
    return 'audio'
  }

  if (
    m.startsWith('video/') ||
    /^(mp4|mov|avi|mkv|webm|wmv|m4v|mpeg|mpg|3gp)$/.test(ext)
  ) {
    return 'video'
  }

  if (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    /^(xlsx?|xlsm|csv|ods)$/.test(ext)
  ) {
    return 'spreadsheet'
  }

  if (
    m.includes('powerpoint') ||
    m.includes('presentation') ||
    /^(pptx?|pptm|odp|key)$/.test(ext)
  ) {
    return 'presentation'
  }

  if (
    m.includes('zip') ||
    m.includes('rar') ||
    m.includes('7z') ||
    m.includes('tar') ||
    m.includes('gzip') ||
    /^(zip|rar|7z|tar|gz|bz2|xz|tgz)$/.test(ext)
  ) {
    return 'archive'
  }

  if (
    m.includes('javascript') ||
    m.includes('json') ||
    m.includes('xml') ||
    /^(js|ts|tsx|jsx|json|xml|html?|css|py|java|cs|cpp|c|h|rb|go|rs|sql|yaml|yml|sh|bat|ps1)$/.test(
      ext
    )
  ) {
    return 'code'
  }

  if (
    m.startsWith('text/') ||
    /^(txt|md|rtf|log|ini|cfg)$/.test(ext)
  ) {
    return 'text'
  }

  if (
    m.includes('word') ||
    m.includes('msword') ||
    m.includes('opendocument.text') ||
    /^(docx?|docm|odt)$/.test(ext)
  ) {
    return 'document'
  }

  return 'generic'
}

export function mailFileVisualKindLabelKey(kind: MailFileVisualKind): string {
  return KIND_META[kind].i18nKey
}

export function mailFileRowIcon(mime: string | null, name: string): LucideIcon {
  return KIND_META[resolveMailFileVisualKind(mime, name)].icon
}

export function MailFileTypeIcon({
  mime,
  name,
  className,
  size = 'row'
}: {
  mime: string | null
  name: string
  className?: string
  size?: 'row' | 'tile'
}): JSX.Element {
  const kind = resolveMailFileVisualKind(mime, name)
  const { icon: Icon, className: color } = KIND_META[kind]
  const sizeClass = size === 'tile' ? 'h-10 w-10' : 'h-4 w-4'
  return <Icon className={cn(sizeClass, 'shrink-0', color, className)} aria-hidden />
}

export function mailFileCategoryIcon(category: FilesMailCategory): typeof File {
  switch (category) {
    case 'images':
      return FileImage
    case 'media':
      return FileVideo
    case 'documents':
      return FileText
    case 'archive':
      return FileArchive
    default:
      return File
  }
}
