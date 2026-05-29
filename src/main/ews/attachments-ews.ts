import type { AttachmentMeta } from '@shared/types'
import { loadConfig } from '../config'
import { listAccounts } from '../accounts'
import { acquireEwsAccessToken } from '../auth/microsoft-ews'
import { postEwsSoap, itemIdXml, escapeXmlText, EwsRequestError } from './ews-soap'
import { translateRestIdToEwsId } from './translate-exchange-ids'
import { decodeXmlEntities } from './xml-decode'

async function ewsSoapContext(accountId: string): Promise<{ token: string; anchor: string }> {
  const config = await loadConfig()
  if (!config.microsoftClientId) throw new Error('Keine Azure Client-ID konfiguriert.')
  const token = await acquireEwsAccessToken(config.microsoftClientId, accountId)
  const accounts = await listAccounts()
  const email = accounts.find((a) => a.id === accountId)?.email?.trim()
  if (!email) throw new Error('Konto-E-Mail fuer EWS nicht gefunden.')
  return { token, anchor: email }
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<t:${tag}[^>]*>([\\s\\S]*?)<\\/t:${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1] ?? '')
  return out
}

function extractFirstText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<t:${tag}[^>]*>([\\s\\S]*?)<\\/t:${tag}>`, 'i'))
  if (!m) return null
  const v = decodeXmlEntities((m[1] ?? '').trim())
  return v || null
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<t:${tag}[^>]*\\s${attr}="([^"]*)"`, 'i'))
  return m?.[1]?.trim() ?? null
}

function parseBool(s: string | null): boolean {
  return (s ?? '').trim().toLowerCase() === 'true'
}

export async function listEwsAttachmentsMeta(
  accountId: string,
  restMessageId: string
): Promise<AttachmentMeta[]> {
  const ewsItemId = await translateRestIdToEwsId(accountId, restMessageId)
  const { token, anchor } = await ewsSoapContext(accountId)

  let xml: string
  try {
    xml = await postEwsSoap({
      accessToken: token,
      anchorMailbox: anchor,
      bodyXml: `<m:GetItem>
  <m:ItemShape>
    <t:BaseShape>IdOnly</t:BaseShape>
    <t:AdditionalProperties>
      <t:FieldURI FieldURI="item:Attachments"/>
    </t:AdditionalProperties>
  </m:ItemShape>
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:GetItem>`
    })
  } catch (e) {
    if (e instanceof EwsRequestError && e.responseCode === 'ErrorItemNotFound') return []
    throw e
  }

  const attsContainer =
    xml.match(/<t:Attachments[^>]*>([\s\S]*?)<\/t:Attachments>/i)?.[1] ?? ''
  if (!attsContainer) return []

  const fileBlocks = extractAllBlocks(attsContainer, 'FileAttachment')
  const itemBlocks = extractAllBlocks(attsContainer, 'ItemAttachment')

  const out: AttachmentMeta[] = []
  for (const b of fileBlocks) {
    const id = extractAttr(b, 'AttachmentId', 'Id')
    if (!id) continue
    out.push({
      id,
      name: extractFirstText(b, 'Name') ?? 'attachment',
      contentType: extractFirstText(b, 'ContentType'),
      size: (() => {
        const s = extractFirstText(b, 'Size')
        const n = s ? Number(s) : NaN
        return Number.isFinite(n) ? n : null
      })(),
      isInline: parseBool(extractFirstText(b, 'IsInline')),
      contentId: extractFirstText(b, 'ContentId')
    })
  }
  for (const b of itemBlocks) {
    const id = extractAttr(b, 'AttachmentId', 'Id')
    if (!id) continue
    out.push({
      id,
      name: extractFirstText(b, 'Name') ?? 'attachment',
      contentType: 'message/rfc822',
      size: null,
      isInline: false,
      contentId: null
    })
  }
  return out
}

export async function downloadEwsAttachmentBytes(
  accountId: string,
  attachmentId: string
): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const { token, anchor } = await ewsSoapContext(accountId)

  let xml: string
  try {
    xml = await postEwsSoap({
      accessToken: token,
      anchorMailbox: anchor,
      bodyXml: `<m:GetAttachment>
  <m:AttachmentShape>
    <t:IncludeMimeContent>true</t:IncludeMimeContent>
  </m:AttachmentShape>
  <m:AttachmentIds>
    <t:AttachmentId Id="${escapeXmlText(attachmentId)}"/>
  </m:AttachmentIds>
</m:GetAttachment>`
    })
  } catch (e) {
    if (e instanceof EwsRequestError && e.responseCode === 'ErrorItemNotFound') {
      throw new Error('Anhang nicht gefunden.')
    }
    throw e
  }

  const name = extractFirstText(xml, 'Name') ?? 'attachment'
  const contentType = extractFirstText(xml, 'ContentType')
  const contentB64 = extractFirstText(xml, 'Content')
  if (!contentB64) {
    throw new Error('Anhang enthaelt keine Daten.')
  }
  return {
    name,
    contentType,
    bytes: Buffer.from(contentB64, 'base64')
  }
}

export async function fetchEwsInlineImages(
  accountId: string,
  restMessageId: string
): Promise<Record<string, string>> {
  const meta = await listEwsAttachmentsMeta(accountId, restMessageId)
  const inline = meta.filter((m) => m.isInline && m.contentId)
  if (inline.length === 0) return {}

  const out: Record<string, string> = {}
  for (const a of inline) {
    try {
      const full = await downloadEwsAttachmentBytes(accountId, a.id)
      const mime = full.contentType ?? 'image/png'
      const cid = (a.contentId ?? '').replace(/^<|>$/g, '')
      out[cid] = `data:${mime};base64,${full.bytes.toString('base64')}`
    } catch {
      // ignore inline image failures
    }
  }
  return out
}

