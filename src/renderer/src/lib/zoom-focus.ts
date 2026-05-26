/** TipTap/ProseMirror-Schreibfläche (Antwort verfassen). */
export function isComposeEditorFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  return !!active.closest('.ProseMirror[contenteditable="true"]')
}
