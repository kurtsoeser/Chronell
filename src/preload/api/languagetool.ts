import { ipcRenderer } from 'electron'
import { IPC } from '@shared/types'
import type {
  LanguageToolCheckInput,
  LanguageToolCheckOutput,
  LanguageToolCredentialsStatus,
  LanguageToolSetApiKeyInput
} from '@shared/types'

export const languageToolApi = {
  check: (input: LanguageToolCheckInput): Promise<LanguageToolCheckOutput> =>
    ipcRenderer.invoke(IPC.languageTool.check, input),
  getCredentialsStatus: (): Promise<LanguageToolCredentialsStatus> =>
    ipcRenderer.invoke(IPC.languageTool.getCredentialsStatus),
  setApiKey: (input: LanguageToolSetApiKeyInput): Promise<LanguageToolCredentialsStatus> =>
    ipcRenderer.invoke(IPC.languageTool.setApiKey, input)
}
