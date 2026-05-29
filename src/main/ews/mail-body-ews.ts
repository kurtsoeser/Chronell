import { loadConfig } from '../config'
import { listAccounts } from '../accounts'
import { acquireEwsAccessToken } from '../auth/microsoft-ews'
import { postEwsSoap, escapeXmlText, itemIdXml, EwsRequestError } from './ews-soap'
import { translateRestIdToEwsId } from './translate-exchange-ids'
import { decodeXmlEntities } from './xml-decode'

function extractTagWithAttrs(
  xml: string,
  tag: string
): { attrs: Record<string, string>; inner: string } | null {
  const re = new RegExp(`<t:${tag}([^>]*)>([\\s\\S]*?)<\\/t:${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return null
  const attrStr = m[1] ?? ''
  const attrs: Record<string, string> = {}
  for (const a of attrStr.matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[a[1]!] = a[2]!
  }
  return { attrs, inner: m[2] ?? '' }
}

async function ewsSoapContext(accountId: string): Promise<{ token: string; anchor: string }> {
  const config = await loadConfig()
  if (!config.microsoftClientId) throw new Error('Keine Azure Client-ID konfiguriert.')
  const token = await acquireEwsAccessToken(config.microsoftClientId, accountId)
  const accounts = await listAccounts()
  const email = accounts.find((a) => a.id === accountId)?.email?.trim()
  if (!email) throw new Error('Konto-E-Mail fuer EWS nicht gefunden.')
  return { token, anchor: email }
}

export async function fetchEwsMessageBody(accountId: string, restMessageId: string): Promise<{
  bodyHtml: string | null
  bodyText: string | null
}> {
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
    <t:BodyType>HTML</t:BodyType>
    <t:AdditionalProperties>
      <t:FieldURI FieldURI="item:Body"/>
      <t:FieldURI FieldURI="item:TextBody"/>
    </t:AdditionalProperties>
  </m:ItemShape>
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:GetItem>`
    })
  } catch (e) {
    if (e instanceof EwsRequestError && e.responseCode === 'ErrorItemNotFound') {
      return { bodyHtml: null, bodyText: null }
    }
    throw e
  }

  const body = extractTagWithAttrs(xml, 'Body')
  const textBody = extractTagWithAttrs(xml, 'TextBody')

  let html: string | null = null
  let text: string | null = null

  if (body) {
    const type = (body.attrs.BodyType ?? body.attrs.bodyType ?? '').toLowerCase()
    const content = decodeXmlEntities(body.inner.trim())
    if (content) {
      if (type === 'html' || !type) html = content
      else text = content
    }
  }
  if (!text && textBody) {
    const content = decodeXmlEntities(textBody.inner.trim())
    if (content) text = content
  }

  return { bodyHtml: html, bodyText: text }
}

