import type { NoteM365VideoEmbedRef } from './note-m365-video-embed'

export interface ResolveM365VideoInput {
  shareUrl: string
  accountId?: string
}

export type ResolveM365VideoResult =
  | {
      ok: true
      ref: NoteM365VideoEmbedRef
    }
  | {
      ok: false
      error: NoteM365VideoEmbedRef['error']
      message: string
      ref: NoteM365VideoEmbedRef
    }
