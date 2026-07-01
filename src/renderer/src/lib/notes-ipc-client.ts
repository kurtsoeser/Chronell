import { IPC } from '@shared/ipc-channels'
import type {
  UserNote,
  UserNoteMoveToParentInput,
  UserNoteSetCategoriesInput,
  UserNoteSetPinnedInput
} from '@shared/types'

type InvokeFn = (channel: string, payload?: unknown) => Promise<unknown>

type NotesTopLevelMethod = 'setCategories' | 'setPinned' | 'moveToParent'

function getInvoke(): InvokeFn | undefined {
  const m = window.mailClient as typeof window.mailClient & { invoke?: InvokeFn }
  return typeof m.invoke === 'function' ? m.invoke : undefined
}

async function notesInvoke<T>(
  method: NotesTopLevelMethod,
  channel: string,
  input: unknown
): Promise<T> {
  const notes = window.mailClient?.notes
  const fn = notes?.[method]
  if (typeof fn === 'function') {
    return (fn as (arg: unknown) => Promise<T>).call(notes, input)
  }
  const inv = getInvoke()
  if (inv) {
    return inv(channel, input) as Promise<T>
  }
  return Promise.reject(
    new Error('Notizen: Bitte MailClient vollständig beenden und neu starten (Preload-Update).')
  )
}

export function safeSetNoteCategories(input: UserNoteSetCategoriesInput): Promise<UserNote> {
  return notesInvoke('setCategories', IPC.notes.setCategories, input)
}

export function safeSetNotePinned(input: UserNoteSetPinnedInput): Promise<UserNote> {
  return notesInvoke('setPinned', IPC.notes.setPinned, input)
}

export function safeMoveNoteToParent(input: UserNoteMoveToParentInput): Promise<UserNote> {
  return notesInvoke('moveToParent', IPC.notes.moveToParent, input)
}
