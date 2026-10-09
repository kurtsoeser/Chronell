import { ipcMain } from 'electron'
import {
  IPC,
  type LanguageToolCheckInput,
  type LanguageToolCheckResponse,
  type LanguageToolCredentialsStatus,
  type LanguageToolSetApiKeyInput
} from '@shared/types'
import { assertAppOnline } from '../network-status'
import { languageToolCheckText } from '../languagetool-check'
import {
  hasLanguageToolApiKey,
  readLanguageToolApiKey,
  writeLanguageToolApiKey
} from '../languagetool-credentials'

export function registerLanguageToolIpc(): void {
  ipcMain.removeHandler(IPC.languageTool.check)
  ipcMain.handle(
    IPC.languageTool.check,
    async (_event, input: LanguageToolCheckInput): Promise<LanguageToolCheckResponse> => {
      assertAppOnline()
      const payload = input ?? { text: '' }
      const apiKey = await readLanguageToolApiKey()
      return languageToolCheckText({
        text: payload.text ?? '',
        language: payload.language,
        apiBaseUrl: payload.apiBaseUrl,
        username: payload.username,
        apiKey: apiKey ?? undefined
      })
    }
  )

  ipcMain.removeHandler(IPC.languageTool.getCredentialsStatus)
  ipcMain.handle(
    IPC.languageTool.getCredentialsStatus,
    async (): Promise<LanguageToolCredentialsStatus> => ({
      hasApiKey: await hasLanguageToolApiKey()
    })
  )

  ipcMain.removeHandler(IPC.languageTool.setApiKey)
  ipcMain.handle(
    IPC.languageTool.setApiKey,
    async (_event, input: LanguageToolSetApiKeyInput): Promise<LanguageToolCredentialsStatus> => {
      await writeLanguageToolApiKey(input?.apiKey ?? null)
      return { hasApiKey: await hasLanguageToolApiKey() }
    }
  )
}
