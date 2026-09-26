import { ipcRenderer } from 'electron'
import { IPC, type MsFormListItem, type MsFormsListMineInput } from '@shared/types'

export const msFormsApi = {
  listMine: (input: MsFormsListMineInput): Promise<MsFormListItem[]> =>
    ipcRenderer.invoke(IPC.msForms.listMine, input)
}
