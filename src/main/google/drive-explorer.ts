import type { drive_v3 } from 'googleapis'
import type { ComposeDriveExplorerEntry } from '@shared/types'
import type { FilesListGoogleDriveInput, GoogleDriveExplorerScope } from '@shared/files'
import { google } from 'googleapis'
import { loadConfig } from '../config'
import { createGoogleOAuth2Client } from '../auth/google'
import {
  GOOGLE_DRIVE_READONLY_SCOPE_URL,
  storedGoogleScopeIncludesDriveReadonly
} from '../auth/google-scopes'
import { getGoogleCredentials } from './google-credentials-store'
import { sanitizeFileName } from '../ipc/ipc-helpers'

const LIST_FIELDS =
  'nextPageToken,files(id,name,mimeType,size,webViewLink,shortcutDetails/targetMimeType,trashed)'

function assertGoogleDriveReadonlyScope(scope: string | null | undefined): void {
  if (storedGoogleScopeIncludesDriveReadonly(scope)) return
  throw new Error(
    `Google Drive erfordert den OAuth-Scope «${GOOGLE_DRIVE_READONLY_SCOPE_URL}». ` +
      'Bitte das Google-Konto in den Einstellungen entfernen und erneut verbinden.'
  )
}

async function getGoogleDriveClient(accountId: string): Promise<drive_v3.Drive> {
  const stored = await getGoogleCredentials(accountId)
  assertGoogleDriveReadonlyScope(stored?.scope)
  const config = await loadConfig()
  const clientId = config.googleClientId?.trim()
  const clientSecret = config.googleClientSecret?.trim()
  if (!clientId || !stored?.refresh_token) {
    throw new Error('Google-Konto ist nicht angemeldet.')
  }
  const oauth2 = createGoogleOAuth2Client(clientId, clientSecret ?? undefined)
  oauth2.setCredentials({
    refresh_token: stored.refresh_token,
    access_token: stored.access_token ?? undefined,
    expiry_date: stored.expiry_date ?? undefined
  })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function isFolderMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/vnd.google-apps.folder'
}

function mapGoogleDriveFile(file: drive_v3.Schema$File): ComposeDriveExplorerEntry | null {
  const id = file.id?.trim()
  const name = file.name?.trim()
  if (!id || !name || file.trashed) return null
  const shortcut = file.shortcutDetails
  const resolvedMime = shortcut?.targetMimeType ?? file.mimeType ?? null
  const isFolder = isFolderMime(resolvedMime)
  const webUrl =
    typeof file.webViewLink === 'string' && file.webViewLink.length > 0 ? file.webViewLink : null
  return {
    id,
    name,
    webUrl,
    size: typeof file.size === 'string' ? Number(file.size) : file.size ?? null,
    mimeType: resolvedMime,
    isFolder
  }
}

function buildListQuery(
  scope: GoogleDriveExplorerScope,
  folderId: string | null | undefined
): string {
  const folder = folderId?.trim()
  if (folder) {
    return `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`
  }
  switch (scope) {
    case 'sharedWithMe':
      return 'sharedWithMe and trashed=false'
    case 'starred':
      return 'starred and trashed=false'
    case 'mydrive':
    default:
      return "'root' in parents and trashed=false"
  }
}

async function listAllPages(
  drive: drive_v3.Drive,
  params: drive_v3.Params$Resource$Files$List
): Promise<ComposeDriveExplorerEntry[]> {
  const out: ComposeDriveExplorerEntry[] = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      ...params,
      pageToken,
      pageSize: 200,
      fields: LIST_FIELDS,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    })
    for (const raw of res.data.files ?? []) {
      const mapped = mapGoogleDriveFile(raw)
      if (mapped) out.push(mapped)
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  out.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  })
  return out
}

export async function listGoogleDriveExplorer(
  input: FilesListGoogleDriveInput
): Promise<ComposeDriveExplorerEntry[]> {
  const accountId = input.accountId?.trim()
  if (!accountId) throw new Error('Kein Konto ausgewählt.')
  const drive = await getGoogleDriveClient(accountId)
  const scope = input.scope ?? 'mydrive'
  const folderId = input.folderId ?? null
  const q = buildListQuery(scope, folderId)
  return listAllPages(drive, {
    q,
    orderBy: scope === 'starred' && !folderId ? 'modifiedTime desc' : 'folder,name'
  })
}

export async function downloadGoogleDriveItem(input: {
  accountId: string
  itemId: string
}): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const itemId = input.itemId.trim()
  if (!itemId) throw new Error('Datei-ID fehlt.')
  const drive = await getGoogleDriveClient(input.accountId)
  const meta = await drive.files.get({
    fileId: itemId,
    fields: 'id,name,mimeType,shortcutDetails/targetId,shortcutDetails/targetMimeType'
  })
  const mime = meta.data.shortcutDetails?.targetMimeType ?? meta.data.mimeType ?? null
  if (isFolderMime(mime)) {
    throw new Error('Ordner können nicht heruntergeladen werden.')
  }
  const exportMime =
    mime === 'application/vnd.google-apps.document'
      ? 'application/pdf'
      : mime === 'application/vnd.google-apps.spreadsheet'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : mime === 'application/vnd.google-apps.presentation'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : null
  const name = sanitizeFileName(meta.data.name?.trim() || 'datei')
  if (exportMime) {
    const res = await drive.files.export(
      { fileId: itemId, mimeType: exportMime },
      { responseType: 'arraybuffer' }
    )
    const data = res.data
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
    const ext =
      exportMime === 'application/pdf'
        ? '.pdf'
        : exportMime.includes('spreadsheet')
          ? '.xlsx'
          : '.pptx'
    return {
      name: name.includes('.') ? name : `${name}${ext}`,
      contentType: exportMime,
      bytes
    }
  }
  const res = await drive.files.get({ fileId: itemId, alt: 'media' }, { responseType: 'arraybuffer' })
  const data = res.data
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
  return {
    name,
    contentType: mime,
    bytes
  }
}

export async function renameGoogleDriveItem(input: {
  accountId: string
  itemId: string
  newName: string
}): Promise<void> {
  const newName = sanitizeFileName(input.newName.trim())
  if (!newName) throw new Error('Name darf nicht leer sein.')
  const drive = await getGoogleDriveClient(input.accountId)
  await drive.files.update({
    fileId: input.itemId.trim(),
    requestBody: { name: newName }
  })
}

export async function deleteGoogleDriveItem(input: {
  accountId: string
  itemId: string
}): Promise<void> {
  const drive = await getGoogleDriveClient(input.accountId)
  await drive.files.delete({ fileId: input.itemId.trim() })
}
