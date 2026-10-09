import { ipcMain } from 'electron'
import {
  IPC,
  type SpellcheckContextMenuSpellInput,
  type SpellcheckContextMenuSpellResult,
  type SpellcheckReplaceMisspellingInput,
  type SpellcheckSuggestInput,
  type SpellcheckSuggestResult
} from '@shared/types'
import { readStashedContextMenuSpell } from '../chromium-context-menu-spell'
import { germanSpellLookup } from '../hunspell-de'

export function registerSpellcheckIpc(): void {
  ipcMain.removeHandler(IPC.spellcheck.suggest)
  ipcMain.handle(
    IPC.spellcheck.suggest,
    (_event, input: SpellcheckSuggestInput): SpellcheckSuggestResult => {
      const word = (input?.word ?? '').trim()
      if (!word) return { correct: true, suggestions: [] }
      return germanSpellLookup(word)
    }
  )

  ipcMain.removeHandler(IPC.spellcheck.getContextMenuSpell)
  ipcMain.handle(
    IPC.spellcheck.getContextMenuSpell,
    (event, input: SpellcheckContextMenuSpellInput): SpellcheckContextMenuSpellResult | null => {
      const x = input?.x ?? 0
      const y = input?.y ?? 0
      return readStashedContextMenuSpell(event.sender.id, x, y)
    }
  )

  ipcMain.removeHandler(IPC.spellcheck.replaceMisspelling)
  ipcMain.handle(
    IPC.spellcheck.replaceMisspelling,
    (event, input: SpellcheckReplaceMisspellingInput): void => {
      const suggestion = input?.suggestion?.trim()
      if (!suggestion) return
      event.sender.replaceMisspelling(suggestion)
    }
  )

  ipcMain.removeHandler(IPC.spellcheck.addWordToDictionary)
  ipcMain.handle(IPC.spellcheck.addWordToDictionary, (event, input: { word?: string }): void => {
    const word = input?.word?.trim()
    if (!word) return
    event.sender.session.addWordToSpellCheckerDictionary(word)
  })
}
