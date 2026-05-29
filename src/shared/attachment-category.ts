export type FilesMailCategory = 'all' | 'images' | 'media' | 'documents' | 'archive'

const ARCHIVE_EXT = /\.(zip|rar|7z|tar|gz|bz2|xz)$/i
const DOC_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf|txt|md|csv)$/i

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/** Prüft, ob MIME/Dateiname zur Kategorie passt (nur für Mail-Anhänge-Index). */
export function matchesFilesMailCategory(
  category: FilesMailCategory,
  mime: string | null,
  name: string
): boolean {
  if (category === 'all') return true
  const m = (mime ?? '').toLowerCase()
  const ext = extOf(name)

  switch (category) {
    case 'images':
      return m.startsWith('image/')
    case 'media':
      return m.startsWith('video/') || m.startsWith('audio/')
    case 'documents':
      return (
        m === 'application/pdf' ||
        m.startsWith('text/') ||
        m.includes('word') ||
        m.includes('excel') ||
        m.includes('spreadsheet') ||
        m.includes('powerpoint') ||
        m.includes('presentation') ||
        DOC_EXT.test(ext)
      )
    case 'archive':
      return (
        m.includes('zip') ||
        m.includes('rar') ||
        m.includes('7z') ||
        m.includes('tar') ||
        m.includes('gzip') ||
        ARCHIVE_EXT.test(ext)
      )
    default:
      return true
  }
}
