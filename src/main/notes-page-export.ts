import { BrowserWindow, dialog, type BrowserWindow as ElectronBrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import { buildNotePagePrintHtml } from '@shared/note-page-print-html'
import { sanitizeFileName } from './ipc/ipc-helpers'

export interface NotePageExportInput {
  title: string
  bodyHtml: string
  suggestedFileName?: string
}

async function loadPrintHtmlInWindow(win: ElectronBrowserWindow, html: string): Promise<void> {
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise<void>((resolve) => {
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => resolve())
      return
    }
    resolve()
  })
}

export async function exportNotePageToPdf(
  parentWin: ElectronBrowserWindow | undefined,
  input: NotePageExportInput
): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  })

  try {
    const documentHtml = buildNotePagePrintHtml(input.title, input.bodyHtml)
    await loadPrintHtmlInWindow(win, documentHtml)
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })

    const suggested = sanitizeFileName(input.suggestedFileName ?? `${input.title || 'Notiz'}.pdf`)
    const saveOptions = {
      defaultPath: suggested.endsWith('.pdf') ? suggested : `${suggested}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const result = parentWin
      ? await dialog.showSaveDialog(parentWin, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (result.canceled || !result.filePath) {
      return { ok: false, cancelled: true }
    }

    await fs.writeFile(result.filePath, pdfBuffer)
    return { ok: true, path: result.filePath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    win.destroy()
  }
}

export async function printNotePage(
  input: NotePageExportInput
): Promise<{ ok: boolean; error?: string }> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  })

  try {
    const documentHtml = buildNotePagePrintHtml(input.title, input.bodyHtml)
    await loadPrintHtmlInWindow(win, documentHtml)
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (success) resolve()
        else reject(new Error(failureReason || 'Druck fehlgeschlagen.'))
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    win.destroy()
  }
}
