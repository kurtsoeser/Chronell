import { ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type {
  OneNoteCatalog,
  OneNoteSendMailInput,
  OneNoteSendMailResult
} from '../../shared/types/onenote'

export const onenoteApi = {
  listCatalog: (messageId: number): Promise<OneNoteCatalog> =>
    ipcRenderer.invoke(IPC.onenote.listCatalog, { messageId }),

  sendMail: (input: OneNoteSendMailInput): Promise<OneNoteSendMailResult> =>
    ipcRenderer.invoke(IPC.onenote.sendMail, input)
}
