import type { ComposeAttachment } from '@shared/types'

/**
 * Wandelt `data:`-Inline-Bilder in `cid:` + Compose-Anhaenge um.
 * Outlook blendet data-URLs und externe Bilder oft erst nach „Bilder herunterladen“ ein —
 * CID-Inline-Attachments erscheinen sofort im Termin.
 */
export function extractDataUriImagesToCidAttachments(html: string): {
  html: string
  attachments: ComposeAttachment[]
} {
  const attachments: ComposeAttachment[] = []
  const next = html.replace(
    /<img\b([^>]*?)\bsrc\s*=\s*(["'])data:([^;"']+);base64,([A-Za-z0-9+/=]+)\2([^>]*)>/gi,
    (_match, pre: string, _q: string, mime: string, b64: string, post: string) => {
      const safeMime = mime.trim() || 'image/png'
      const cid = `webinar-hero-${Date.now().toString(36)}-${attachments.length}@chronell.local`
      const ext = safeMime.includes('jpeg') || safeMime.includes('jpg')
        ? 'jpg'
        : safeMime.includes('gif')
          ? 'gif'
          : safeMime.includes('webp')
            ? 'webp'
            : 'png'
      attachments.push({
        name: `webinar-hero-${attachments.length + 1}.${ext}`,
        contentType: safeMime,
        size: Math.round((b64.length * 3) / 4),
        dataBase64: b64,
        isInline: true,
        contentId: cid
      })
      return `<img${pre}src="cid:${cid}"${post}>`
    }
  )
  return { html: next, attachments }
}
