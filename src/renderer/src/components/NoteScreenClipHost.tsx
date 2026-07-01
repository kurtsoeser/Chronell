import { useEffect } from 'react'

/** Leitet globalen Screen-Clip-Hotkey an NotesShell weiter. */
export function NoteScreenClipHost(): null {
  useEffect(() => {
    return window.mailClient.notes.onScreenClipTrigger(() => {
      window.dispatchEvent(new CustomEvent('notes:screen-clip-request'))
    })
  }, [])

  return null
}
