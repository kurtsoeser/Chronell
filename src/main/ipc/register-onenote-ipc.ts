import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { OneNoteSendMailInput } from '../../shared/types/onenote'
import { listOneNoteCatalogForMail, sendMailToOneNote } from '../onenote/onenote-service'

export function registerOneNoteIpc(): void {
  ipcMain.handle(IPC.onenote.listCatalog, async (_event, input: { messageId?: number }) => {
    return listOneNoteCatalogForMail(Number(input?.messageId))
  })

  ipcMain.handle(IPC.onenote.sendMail, async (_event, input: OneNoteSendMailInput) => {
    return sendMailToOneNote(input)
  })
}
