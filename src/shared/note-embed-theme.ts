export type NoteEmbedTheme = 'light' | 'dark'

export interface NoteEmbedThemeOptions {
  theme?: NoteEmbedTheme
}

export function normalizeNoteEmbedTheme(value: string | null | undefined): NoteEmbedTheme {
  return value === 'dark' ? 'dark' : 'light'
}
