import type {
  FilesMailCategory,
  FilesMailGroupBy,
  FilesMailViewMode,
  FilesMailSortBy,
  FilesShellSourceId,
  FilesSortDir
} from '@shared/files'
import type { ComposeDriveExplorerNavCrumb, ComposeDriveExplorerScope } from '@shared/types'

const SOURCE_KEY = 'mailclient.filesShell.source.v1'
const CLOUD_ACCOUNT_KEY = 'mailclient.filesShell.cloudAccountId.v1'
const CLOUD_SCOPE_KEY = 'mailclient.filesShell.cloudScope.v1'
const CLOUD_CRUMBS_KEY = 'mailclient.filesShell.cloudCrumbs.v1'
const CATEGORY_KEY = 'mailclient.filesShell.category.v1'
const SORT_BY_KEY = 'mailclient.filesShell.sortBy.v1'
const SORT_DIR_KEY = 'mailclient.filesShell.sortDir.v1'
const ACCOUNTS_KEY = 'mailclient.filesShell.accountIds.v1'
const SEARCH_KEY = 'mailclient.filesShell.search.v1'
const CONTACT_EMAIL_KEY = 'mailclient.filesShell.contactEmail.v1'
const CONTACT_EMAILS_KEY = 'mailclient.filesShell.contactEmails.v1'
const GROUP_BY_KEY = 'mailclient.filesShell.groupBy.v1'
const VIEW_MODE_KEY = 'mailclient.filesShell.viewMode.v1'

export function readFilesShellContactEmail(): string | null {
  try {
    const v = window.localStorage.getItem(CONTACT_EMAIL_KEY)?.trim()
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function readFilesShellContactEmails(): string[] {
  try {
    const raw = window.localStorage.getItem(CONTACT_EMAILS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string' && x.includes('@'))
      }
    }
    const single = readFilesShellContactEmail()
    return single ? [single] : []
  } catch {
    const single = readFilesShellContactEmail()
    return single ? [single] : []
  }
}

export function persistFilesShellContactEmail(email: string | null): void {
  try {
    if (email?.trim()) window.localStorage.setItem(CONTACT_EMAIL_KEY, email.trim().toLowerCase())
    else window.localStorage.removeItem(CONTACT_EMAIL_KEY)
  } catch {
    // ignore
  }
}

export function persistFilesShellContactEmails(emails: string[] | null): void {
  try {
    const list = emails?.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')) ?? []
    if (list.length > 0) {
      window.localStorage.setItem(CONTACT_EMAILS_KEY, JSON.stringify([...new Set(list)]))
      persistFilesShellContactEmail(list[0] ?? null)
    } else {
      window.localStorage.removeItem(CONTACT_EMAILS_KEY)
      persistFilesShellContactEmail(null)
    }
  } catch {
    // ignore
  }
}

const GROUP_BY_VALUES: FilesMailGroupBy[] = [
  'date',
  'fileType',
  'size',
  'nameLetter',
  'from',
  'account',
  'extension',
  'subjectLetter'
]

export function readFilesShellViewMode(): FilesMailViewMode {
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY)
    if (v === 'table' || v === 'tiles') return v
  } catch {
    // ignore
  }
  return 'table'
}

export function persistFilesShellViewMode(mode: FilesMailViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // ignore
  }
}

export function readFilesShellGroupBy(): FilesMailGroupBy {
  try {
    const v = window.localStorage.getItem(GROUP_BY_KEY)
    if (v && GROUP_BY_VALUES.includes(v as FilesMailGroupBy)) return v as FilesMailGroupBy
  } catch {
    // ignore
  }
  return 'date'
}

export function persistFilesShellGroupBy(groupBy: FilesMailGroupBy): void {
  try {
    window.localStorage.setItem(GROUP_BY_KEY, groupBy)
  } catch {
    // ignore
  }
}

export function readFilesShellCategory(): FilesMailCategory {
  try {
    const v = window.localStorage.getItem(CATEGORY_KEY)
    if (
      v === 'all' ||
      v === 'images' ||
      v === 'media' ||
      v === 'documents' ||
      v === 'archive'
    ) {
      return v
    }
  } catch {
    // ignore
  }
  return 'all'
}

export function persistFilesShellCategory(category: FilesMailCategory): void {
  try {
    window.localStorage.setItem(CATEGORY_KEY, category)
  } catch {
    // ignore
  }
}

export function readFilesShellSort(): { sortBy: FilesMailSortBy; sortDir: FilesSortDir } {
  try {
    const sortBy = window.localStorage.getItem(SORT_BY_KEY)
    const sortDir = window.localStorage.getItem(SORT_DIR_KEY)
    const by: FilesMailSortBy =
      sortBy === 'name' || sortBy === 'size' || sortBy === 'subject' || sortBy === 'receivedAt'
        ? sortBy
        : 'receivedAt'
    const dir: FilesSortDir = sortDir === 'asc' ? 'asc' : 'desc'
    return { sortBy: by, sortDir: dir }
  } catch {
    // ignore
  }
  return { sortBy: 'receivedAt', sortDir: 'desc' }
}

export function persistFilesShellSort(sortBy: FilesMailSortBy, sortDir: FilesSortDir): void {
  try {
    window.localStorage.setItem(SORT_BY_KEY, sortBy)
    window.localStorage.setItem(SORT_DIR_KEY, sortDir)
  } catch {
    // ignore
  }
}

export function readFilesShellAccountFilter(): string[] | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

export function persistFilesShellAccountFilter(accountIds: string[] | null): void {
  try {
    if (accountIds == null || accountIds.length === 0) {
      window.localStorage.removeItem(ACCOUNTS_KEY)
    } else {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountIds))
    }
  } catch {
    // ignore
  }
}

export function readFilesShellSearch(): string {
  try {
    return window.localStorage.getItem(SEARCH_KEY) ?? ''
  } catch {
    return ''
  }
}

export function persistFilesShellSearch(q: string): void {
  try {
    if (q.trim()) window.localStorage.setItem(SEARCH_KEY, q)
    else window.localStorage.removeItem(SEARCH_KEY)
  } catch {
    // ignore
  }
}

export function readFilesShellSource(): FilesShellSourceId {
  try {
    const v = window.localStorage.getItem(SOURCE_KEY)
    if (v === 'cloud') return 'cloud'
  } catch {
    // ignore
  }
  return 'mail'
}

export function persistFilesShellSource(source: FilesShellSourceId): void {
  try {
    window.localStorage.setItem(SOURCE_KEY, source)
  } catch {
    // ignore
  }
}

export function readFilesShellCloudAccountId(): string | null {
  try {
    return window.localStorage.getItem(CLOUD_ACCOUNT_KEY)
  } catch {
    return null
  }
}

export function persistFilesShellCloudAccountId(accountId: string | null): void {
  try {
    if (accountId) window.localStorage.setItem(CLOUD_ACCOUNT_KEY, accountId)
    else window.localStorage.removeItem(CLOUD_ACCOUNT_KEY)
  } catch {
    // ignore
  }
}

export function readFilesShellCloudScope(): ComposeDriveExplorerScope {
  try {
    const v = window.localStorage.getItem(CLOUD_SCOPE_KEY)
    if (v === 'recent' || v === 'myfiles' || v === 'shared' || v === 'sharepoint') return v
  } catch {
    // ignore
  }
  return 'myfiles'
}

export function persistFilesShellCloudScope(scope: ComposeDriveExplorerScope): void {
  try {
    window.localStorage.setItem(CLOUD_SCOPE_KEY, scope)
  } catch {
    // ignore
  }
}

export function readFilesShellCloudCrumbs(): ComposeDriveExplorerNavCrumb[] {
  try {
    const raw = window.localStorage.getItem(CLOUD_CRUMBS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is ComposeDriveExplorerNavCrumb =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as ComposeDriveExplorerNavCrumb).name === 'string'
    )
  } catch {
    return []
  }
}

export function persistFilesShellCloudCrumbs(crumbs: ComposeDriveExplorerNavCrumb[]): void {
  try {
    if (crumbs.length === 0) window.localStorage.removeItem(CLOUD_CRUMBS_KEY)
    else window.localStorage.setItem(CLOUD_CRUMBS_KEY, JSON.stringify(crumbs))
  } catch {
    // ignore
  }
}
