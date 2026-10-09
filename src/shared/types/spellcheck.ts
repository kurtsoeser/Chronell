export interface SpellcheckSuggestInput {
  word: string
}

export interface SpellcheckSuggestResult {
  correct: boolean
  suggestions: string[]
}

export interface SpellcheckContextMenuSpellInput {
  /** Viewport-Koordinaten (clientX/clientY) vom contextmenu-Event. */
  x: number
  y: number
}

export interface SpellcheckContextMenuSpellResult {
  misspelledWord: string
  suggestions: string[]
}

export interface SpellcheckReplaceMisspellingInput {
  suggestion: string
}
