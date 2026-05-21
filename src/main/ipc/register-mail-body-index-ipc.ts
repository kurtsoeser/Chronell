import { ipcMain } from 'electron'
import type { MailBodyIndexSpeed } from '@shared/mail-body-index'
import { normalizeMailBodyIndexSpeed } from '@shared/mail-body-index'
import { IPC } from '@shared/ipc-channels'
import { getMailBodyIndexStatus } from '../mail-body-index-queue'
import { updateConfig } from '../config'

export function registerMailBodyIndexIpc(): void {
  ipcMain.removeHandler(IPC.mailBodyIndex.getStatus)
  ipcMain.removeHandler(IPC.mailBodyIndex.setSettings)

  ipcMain.handle(IPC.mailBodyIndex.getStatus, () => getMailBodyIndexStatus())

  ipcMain.handle(
    IPC.mailBodyIndex.setSettings,
    async (
      _event,
      patch: { enabled?: boolean; speed?: MailBodyIndexSpeed }
    ): Promise<ReturnType<typeof getMailBodyIndexStatus>> => {
      const configPatch: {
        mailBodyIndexEnabled?: boolean
        mailBodyIndexSpeed?: MailBodyIndexSpeed
      } = {}
      if (typeof patch.enabled === 'boolean') {
        configPatch.mailBodyIndexEnabled = patch.enabled
      }
      if (patch.speed != null) {
        configPatch.mailBodyIndexSpeed = normalizeMailBodyIndexSpeed(patch.speed)
      }
      await updateConfig(configPatch)
      return getMailBodyIndexStatus()
    }
  )
}
