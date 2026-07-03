import { parseMsFormsUrl } from './note-msforms-embed'
import {
  createM365VideoStreamRef,
  parseM365VideoShareUrl,
  serializeM365VideoEmbedRef
} from './note-m365-video-embed'
import { parseSharePointStreamPageEmbedSrc } from './note-m365-stream-embed'
import {
  NOTE_EMBED_REGISTRY,
  findNoteEmbedPasteTarget,
  getNoteEmbedRegistryEntry,
  isEmbeddableNoteUrl,
  isResolvableNoteEmbedUrl,
  type NoteEmbedProviderId
} from './note-embed-registry'

export type { NoteEmbedProviderId }

export interface NoteEmbedInsertTarget {
  extensionName: string
  attrs: Record<string, string>
}

export interface NoteEmbedProviderSummary {
  id: NoteEmbedProviderId
  label: string
}

/** Kuratierte Beispiel-URLs pro Provider (nur Platzhalter im Dialog). */
export const NOTE_EMBED_PROVIDER_URL_HINTS: Partial<Record<NoteEmbedProviderId, string>> = {
  youtube: 'https://www.youtube.com/watch?v=…',
  msForms: 'https://forms.office.com/Pages/ResponsePage.aspx?id=…',
  geogebra: 'https://www.geogebra.org/m/…',
  googleMaps: 'https://www.google.com/maps/…',
  typeform: 'https://form.typeform.com/to/…',
  twitter: 'https://x.com/user/status/…',
  teamsRecording: 'https://…sharepoint.com/…/embed.aspx',
  m365Video: 'https://…sharepoint.com/…/_layouts/15/stream.aspx?id=…',
  spotify: 'https://open.spotify.com/track/…',
  vimeo: 'https://vimeo.com/…',
  soundcloud: 'https://soundcloud.com/…',
  tiktok: 'https://www.tiktok.com/@…/video/…',
  desmos: 'https://www.desmos.com/calculator/…',
  codepen: 'https://codepen.io/user/pen/…',
  gist: 'https://gist.github.com/user/…',
  loom: 'https://www.loom.com/share/…',
  figma: 'https://www.figma.com/file/…',
  miro: 'https://miro.com/app/board/…',
  openstreetmap: 'https://www.openstreetmap.org/…',
  calendly: 'https://calendly.com/user/event'
}

export function listNoteEmbedProviders(): NoteEmbedProviderSummary[] {
  return NOTE_EMBED_REGISTRY.map((entry) => ({ id: entry.id, label: entry.label }))
}

export function findNoteEmbedProviderForUrl(url: string): NoteEmbedProviderId | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  for (const entry of NOTE_EMBED_REGISTRY) {
    if (entry.canParseInput(trimmed)) return entry.id
  }
  return null
}

export function findNoteEmbedInsertTarget(url: string): NoteEmbedInsertTarget | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const directStreamEmbed = parseSharePointStreamPageEmbedSrc(trimmed)
  if (directStreamEmbed) {
    return {
      extensionName: 'noteM365VideoEmbed',
      attrs: {
        ref: serializeM365VideoEmbedRef(createM365VideoStreamRef(trimmed, directStreamEmbed))
      }
    }
  }

  const pasteTarget = findNoteEmbedPasteTarget(trimmed)
  if (pasteTarget) {
    return {
      extensionName: pasteTarget.extensionName,
      attrs: { value: pasteTarget.storedValue }
    }
  }

  const m365ShareUrl = parseM365VideoShareUrl(trimmed)
  if (m365ShareUrl) {
    return {
      extensionName: 'noteM365VideoEmbed',
      attrs: { ref: serializeM365VideoEmbedRef({ shareUrl: m365ShareUrl }) }
    }
  }

  const msForms = parseMsFormsUrl(trimmed)
  if (msForms) {
    return {
      extensionName: 'noteMsFormsEmbed',
      attrs: { formId: msForms.formId, host: msForms.host }
    }
  }

  return null
}

export function noteEmbedUrlLooksInsertable(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  return isEmbeddableNoteUrl(trimmed) || isResolvableNoteEmbedUrl(trimmed)
}

export function getNoteEmbedProviderLabel(id: NoteEmbedProviderId): string {
  return getNoteEmbedRegistryEntry(id)?.label ?? id
}
