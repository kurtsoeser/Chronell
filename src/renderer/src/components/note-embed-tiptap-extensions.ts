import type { Extensions } from '@tiptap/core'
import { NOTE_EMBED_REGISTRY } from '@shared/note-embed-registry'
import { createNoteIframeEmbedExtension } from '@/components/tiptap-note-iframe-embed-factory'
import { NoteEmbedInteractiveEscape } from '@/components/note-embed-interactive-plugin'
import { NoteEmbedResolvableUrlPaste } from '@/components/note-embed-resolvable-url-paste'
import { NoteMsFormsEmbed } from '@/components/tiptap-note-msforms-embed'
import { NoteM365VideoEmbed } from '@/components/tiptap-note-m365-video-embed'

/** TipTap-iframe-Embeds aus der zentralen Registry (ohne MS Forms — eigene Extension). */
const REGISTRY_IFRAME_EMBED_EXTENSIONS: Extensions = NOTE_EMBED_REGISTRY.flatMap((entry) => {
  if (!entry.tiptap) return []
  const { tiptap } = entry
  return [
    createNoteIframeEmbedExtension({
      name: tiptap.extensionName,
      dataAttr: entry.dataAttrs[0]!,
      className: entry.embedClass,
      title: tiptap.title,
      parseInput: tiptap.parseStoredValue,
      buildIframeSrc: tiptap.buildIframeSrc,
      parseIframeSrc: tiptap.parseIframeSrc,
      pasteRegex: tiptap.pasteRegex,
      iframeSelector: tiptap.iframeSelector,
      iframeAllow: tiptap.iframeAllow,
      iframeExtras: tiptap.iframeExtras,
      usesEditorTheme: tiptap.usesEditorTheme
    })
  ]
})

/** Alle TipTap-Embed-Extensions für den Notizen-Editor (Registry-Reihenfolge). */
export const NOTE_EMBED_TIPTAP_EXTENSIONS: Extensions = [
  NoteEmbedResolvableUrlPaste,
  NoteEmbedInteractiveEscape,
  ...REGISTRY_IFRAME_EMBED_EXTENSIONS.slice(0, 1),
  NoteMsFormsEmbed,
  NoteM365VideoEmbed,
  ...REGISTRY_IFRAME_EMBED_EXTENSIONS.slice(1)
]
