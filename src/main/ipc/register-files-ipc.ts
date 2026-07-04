import { ipcMain, BrowserWindow, dialog, shell, type IpcMainInvokeEvent } from 'electron'
import { promises as fs } from 'node:fs'
import { IPC } from '@shared/ipc-channels'
import type {
  FilesListCloudInput,
  FilesListGoogleDriveInput,
  FilesListMailQuery,
  FilesListMailResult,
  FilesOpenCloudItemResult,
  FilesSaveCloudItemInput,
  FilesSaveCloudItemResult,
  FilesSaveMailToDriveInput,
  FilesSaveMailToDriveResult
} from '@shared/files'
import type { ComposeDriveExplorerEntry } from '@shared/types'
import { listAccounts } from '../accounts'
import { graphListDriveExplorer } from '../graph/compose-recipient-graph'
import { graphDownloadDriveItem } from '../graph/drive-download'
import { graphUploadDriveFile } from '../graph/drive-upload'
import { downloadGoogleDriveItem, listGoogleDriveExplorer } from '../google/drive-explorer'
import {
  countMailFiles,
  getMailFileById,
  isMessageAttachmentsIndexed,
  listMailFiles
} from '../db/attachments-repo'
import { getMessageById } from '../db/messages-repo-ops'
import { downloadMailAttachmentBytes } from '../mail-attachment-fetch'
import { getMailAttachmentIndexStatus } from '../mail-attachment-index-queue'
import { indexMessageAttachments } from '../mail-attachment-index-sync'
import { writeAttachmentCacheFile } from '../attachment-cache'
import { sanitizeFileName } from './ipc-helpers'

export function registerFilesIpc(): void {
  ipcMain.removeHandler(IPC.files.listMail)
  ipcMain.removeHandler(IPC.files.getMailIndexStatus)
  ipcMain.removeHandler(IPC.files.openMailAttachment)
  ipcMain.removeHandler(IPC.files.saveMailAttachmentAs)
  ipcMain.removeHandler(IPC.files.saveMailToDrive)
  ipcMain.removeHandler(IPC.files.listCloud)
  ipcMain.removeHandler(IPC.files.listGoogleDrive)
  ipcMain.removeHandler(IPC.files.saveCloudItemAs)
  ipcMain.removeHandler(IPC.files.openCloudItemExternal)

  ipcMain.handle(
    IPC.files.listMail,
    (_event, query: FilesListMailQuery): FilesListMailResult => {
      const rows = listMailFiles(query)
      const total = countMailFiles(query)
      return { rows, total }
    }
  )

  ipcMain.handle(IPC.files.getMailIndexStatus, () => getMailAttachmentIndexStatus())

  ipcMain.handle(
    IPC.files.openMailAttachment,
    async (
      _event,
      args: { fileId: number }
    ): Promise<{ ok: boolean; error?: string }> => {
      const file = getMailFileById(args.fileId)
      if (!file) return { ok: false, error: 'Datei nicht gefunden.' }
      try {
        const downloaded = await downloadMailAttachmentBytes(
          file.messageId,
          file.remoteAttachmentId
        )
        const safeName = sanitizeFileName(downloaded.name)
        const target = await writeAttachmentCacheFile(
          file.remoteAttachmentId,
          safeName,
          downloaded.bytes
        )
        const err = await shell.openPath(target)
        if (err) return { ok: false, error: err }
        return { ok: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle(
    IPC.files.saveMailAttachmentAs,
    async (
      event,
      args: { fileId: number; suggestedName?: string }
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> => {
      const file = getMailFileById(args.fileId)
      if (!file) return { ok: false, error: 'Datei nicht gefunden.' }

      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const suggested = sanitizeFileName(args.suggestedName ?? file.name)
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: suggested,
        title: 'Datei speichern unter'
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, cancelled: true }
      }

      try {
        const downloaded = await downloadMailAttachmentBytes(
          file.messageId,
          file.remoteAttachmentId
        )
        await fs.writeFile(result.filePath, downloaded.bytes)
        return { ok: true, path: result.filePath }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle(
    IPC.files.saveMailToDrive,
    async (_event, args: FilesSaveMailToDriveInput): Promise<FilesSaveMailToDriveResult> => {
      const file = getMailFileById(args.fileId)
      if (!file) return { ok: false, error: 'Datei nicht gefunden.' }

      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === file.accountId)
      if (acc?.provider !== 'microsoft') {
        return {
          ok: false,
          error: 'Speichern in OneDrive/SharePoint ist nur für Microsoft-365-Konten verfügbar.'
        }
      }

      if (args.destination.accountId !== file.accountId) {
        return {
          ok: false,
          error: 'Zielkonto muss dem Mail-Konto der Datei entsprechen.'
        }
      }

      try {
        const downloaded = await downloadMailAttachmentBytes(
          file.messageId,
          file.remoteAttachmentId
        )
        const uploaded = await graphUploadDriveFile({
          accountId: file.accountId,
          destination: args.destination,
          fileName: downloaded.name,
          bytes: downloaded.bytes
        })
        return { ok: true, webUrl: uploaded.webUrl, name: uploaded.name }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle(
    IPC.files.listCloud,
    async (_event, input: FilesListCloudInput): Promise<ComposeDriveExplorerEntry[]> => {
      const accountId = input.accountId?.trim()
      if (!accountId) throw new Error('Kein Konto ausgewählt.')
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc) throw new Error('Konto nicht gefunden.')
      if (acc.provider !== 'microsoft') {
        throw new Error('OneDrive/SharePoint ist nur für Microsoft-365-Konten verfügbar.')
      }
      const scope = input.scope ?? 'myfiles'
      return graphListDriveExplorer(
        accountId,
        scope,
        input.folderId ?? null,
        input.folderDriveId ?? null,
        input.siteId ?? null
      )
    }
  )

  ipcMain.handle(
    IPC.files.listGoogleDrive,
    async (_event, input: FilesListGoogleDriveInput): Promise<ComposeDriveExplorerEntry[]> => {
      const accountId = input.accountId?.trim()
      if (!accountId) throw new Error('Kein Konto ausgewählt.')
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc) throw new Error('Konto nicht gefunden.')
      if (acc.provider !== 'google') {
        throw new Error('Google Drive ist nur für Google-Konten verfügbar.')
      }
      return listGoogleDriveExplorer(input)
    }
  )

  ipcMain.handle(
    IPC.files.saveCloudItemAs,
    async (
      event: IpcMainInvokeEvent,
      args: FilesSaveCloudItemInput
    ): Promise<FilesSaveCloudItemResult> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const suggested = sanitizeFileName(args.suggestedName ?? 'datei')
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: suggested,
        title: 'Datei speichern unter'
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, cancelled: true }
      }
      try {
        const accounts = await listAccounts()
        const acc = accounts.find((a) => a.id === args.accountId)
        const file =
          acc?.provider === 'google'
            ? await downloadGoogleDriveItem({
                accountId: args.accountId,
                itemId: args.itemId
              })
            : await graphDownloadDriveItem({
                accountId: args.accountId,
                itemId: args.itemId,
                driveId: args.driveId
              })
        await fs.writeFile(result.filePath, file.bytes)
        return { ok: true, path: result.filePath }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle(
    IPC.files.openCloudItemExternal,
    async (_event, args: { webUrl: string }): Promise<FilesOpenCloudItemResult> => {
      const url = args.webUrl?.trim()
      if (!url) return { ok: false, error: 'Kein Link vorhanden.' }
      try {
        await shell.openExternal(url)
        return { ok: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )
}

/** Nach Lesepane-Abruf Metadaten in den Index schreiben. */
export function scheduleIndexMessageAttachments(messageId: number): void {
  void indexMessageAttachments(messageId).catch((e) => {
    console.warn('[files] index message', messageId, e)
  })
}

export function scheduleIndexMessageAttachmentsIfNeeded(messageId: number): void {
  const msg = getMessageById(messageId)
  if (!msg?.hasAttachments || isMessageAttachmentsIndexed(messageId)) return
  scheduleIndexMessageAttachments(messageId)
}
