import type { WebContents } from 'electron'

const STASH_MAX_AGE_MS = 2500
const POSITION_SLOP_PX = 12

export type ChromiumContextMenuSpellStash = {
  misspelledWord: string
  suggestions: string[]
  x: number
  y: number
  at: number
}

const stashByContentsId = new Map<number, ChromiumContextMenuSpellStash>()
const attached = new WeakSet<WebContents>()

/** Merkt Chromium-Rechtschreibvorschläge aus dem context-menu-Event für das Renderer-Kontextmenü. */
export function attachChromiumContextMenuSpellCapture(contents: WebContents): void {
  if (attached.has(contents)) return
  attached.add(contents)
  contents.on('context-menu', (_event, params) => {
    const word = params.misspelledWord?.trim()
    const suggestions = params.dictionarySuggestions?.filter((s) => s.trim()) ?? []
    if (!word || suggestions.length === 0) {
      stashByContentsId.delete(contents.id)
      return
    }
    stashByContentsId.set(contents.id, {
      misspelledWord: word,
      suggestions,
      x: params.x,
      y: params.y,
      at: Date.now()
    })
  })
}

export function readStashedContextMenuSpell(
  contentsId: number,
  x: number,
  y: number
): { misspelledWord: string; suggestions: string[] } | null {
  const stash = stashByContentsId.get(contentsId)
  if (!stash) return null
  if (Date.now() - stash.at > STASH_MAX_AGE_MS) {
    stashByContentsId.delete(contentsId)
    return null
  }
  if (
    Math.abs(stash.x - x) > POSITION_SLOP_PX ||
    Math.abs(stash.y - y) > POSITION_SLOP_PX
  ) {
    return null
  }
  return { misspelledWord: stash.misspelledWord, suggestions: stash.suggestions }
}
