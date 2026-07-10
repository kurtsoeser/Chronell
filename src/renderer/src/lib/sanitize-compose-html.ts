import DOMPurify from 'dompurify'
import { promoteIframeSourcesToLinksInHtml } from '@shared/calendar-event-body-html'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'
import { NOTE_CLOUD_TASK_HTML_ATTRS } from '@shared/note-cloud-task'
import { NOTE_FORM_FIELD_SANITIZE_ATTRS } from '@shared/note-form-field'
import { noteEmbedSanitizeDataAttrs } from '@shared/note-embed-registry'
import { isAllowedNoteEmbedIframeSrc } from '@shared/note-embed-frame'
import { stripUnresolvedCidUrls } from '@/lib/sanitize'

const NOTE_MEDIA_SRC_PREFIX = 'note-media://'

function allowNoteMediaSrcHook(
  node: Element,
  data: { attrName: string; attrValue: string; forceKeepAttr?: boolean }
): void {
  if (data.attrName !== 'src' || node.tagName !== 'IMG') return
  if (data.attrValue.startsWith(NOTE_MEDIA_SRC_PREFIX)) {
    data.forceKeepAttr = true
  }
}

const SANITIZE: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
    'blockquote',
    'colgroup',
    'col'
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'style',
    'class',
    'colspan',
    'rowspan',
    'src',
    'alt',
    'width',
    'height',
    'align',
    'border',
    'cellpadding',
    'cellspacing',
    'valign',
    'bgcolor',
    'color',
    'face',
    'size',
    'data-type',
    'data-checked',
    NOTE_INK_HTML_SOURCE_ATTR,
    ...NOTE_CLOUD_TASK_HTML_ATTRS,
    ...NOTE_FORM_FIELD_SANITIZE_ATTRS
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
}

const NOTE_EDITOR_SANITIZE: DOMPurify.Config = {
  ...SANITIZE,
  ALLOWED_TAGS: [...(SANITIZE.ALLOWED_TAGS ?? []), 'iframe'],
  ALLOWED_ATTR: [
    ...(SANITIZE.ALLOWED_ATTR ?? []),
    ...noteEmbedSanitizeDataAttrs(),
    'allow',
    'allowfullscreen',
    'frameborder',
    'loading',
    'referrerpolicy',
    'scrolling',
    'title',
    'data-note-embed-width',
    'data-note-embed-height'
  ],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'style']
}

function sanitizeHtmlFragment(html: string, config: DOMPurify.Config): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const hook = (node: Element): void => {
    if (node.nodeName.toLowerCase() !== 'iframe') return
    const src = node.getAttribute('src') ?? ''
    if (!isAllowedNoteEmbedIframeSrc(src)) {
      node.remove()
    }
  }
  DOMPurify.addHook('afterSanitizeAttributes', hook)
  DOMPurify.addHook('uponSanitizeAttribute', allowNoteMediaSrcHook)
  try {
    return DOMPurify.sanitize(trimmed, config as import('dompurify').Config)
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hook)
    DOMPurify.removeHook('uponSanitizeAttribute', allowNoteMediaSrcHook)
  }
}

/**
 * HTML fuer Compose (Vorlagen, eingefuegte Fragmente) bereinigen.
 * Kein Ersatz fuer serverseitige Pruefung, reduziert aber XSS-Risiken im Renderer.
 */
export function sanitizeComposeHtmlFragment(html: string): string {
  return sanitizeHtmlFragment(html, SANITIZE)
}

/** HTML fuer Notizen-Editor inkl. eingebetteter Medien bereinigen. */
export function sanitizeNoteEditorHtmlFragment(html: string): string {
  return sanitizeHtmlFragment(html, NOTE_EDITOR_SANITIZE)
}

/** HTML fuer TipTap-Compose: bereinigen und unaufloesbare cid:-Bilder neutralisieren. */
export function prepareComposeEditorHtml(html: string): string {
  return stripUnresolvedCidUrls(
    sanitizeComposeHtmlFragment(promoteIframeSourcesToLinksInHtml(html))
  )
}

/** HTML fuer TipTap-Notizen: bereinigen und unaufloesbare cid:-Bilder neutralisieren. */
export function prepareNoteEditorHtml(html: string): string {
  return stripUnresolvedCidUrls(sanitizeNoteEditorHtmlFragment(html))
}
