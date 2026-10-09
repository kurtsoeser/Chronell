import { ipcRenderer } from 'electron'
import { IPC } from '@shared/types'
import type {
  SpellcheckContextMenuSpellInput,
  SpellcheckContextMenuSpellResult,
  SpellcheckReplaceMisspellingInput,
  SpellcheckSuggestInput,
  SpellcheckSuggestResult
} from '@shared/types'

export const spellcheckApi = {
  suggest: (input: SpellcheckSuggestInput): Promise<SpellcheckSuggestResult> =>
    ipcRenderer.invoke(IPC.spellcheck.suggest, input),
  getContextMenuSpell: (
    input: SpellcheckContextMenuSpellInput
  ): Promise<SpellcheckContextMenuSpellResult | null> =>
    ipcRenderer.invoke(IPC.spellcheck.getContextMenuSpell, input),
  replaceMisspelling: (input: SpellcheckReplaceMisspellingInput): Promise<void> =>
    ipcRenderer.invoke(IPC.spellcheck.replaceMisspelling, input),
  addWordToDictionary: (input: { word: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.spellcheck.addWordToDictionary, input)
}
