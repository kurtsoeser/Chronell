import { EWS_ENDPOINT_URL } from '../auth/microsoft-ews'

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/'
const TYPES_NS = 'http://schemas.microsoft.com/exchange/services/2006/types'
const MESSAGES_NS = 'http://schemas.microsoft.com/exchange/services/2006/messages'

export class EwsRequestError extends Error {
  constructor(
    message: string,
    readonly responseCode?: string
  ) {
    super(message)
    this.name = 'EwsRequestError'
  }
}

export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function extractResponseCode(xml: string): string | null {
  const m = xml.match(/<(?:m:)?ResponseCode[^>]*>([^<]+)<\/(?:m:)?ResponseCode>/i)
  return m?.[1]?.trim() ?? null
}

function extractMessageText(xml: string): string | null {
  const m = xml.match(/<(?:m:)?MessageText[^>]*>([^<]+)<\/(?:m:)?MessageText>/i)
  return m?.[1]?.trim() ?? null
}

function extractSoapFaultText(xml: string): string | null {
  const faultstring = xml.match(/<(?:s:)?faultstring[^>]*>([^<]+)/i)?.[1]?.trim()
  if (faultstring) return faultstring
  const reason = xml.match(/<(?:s:)?Text[^>]*xml:lang[^>]*>([^<]+)/i)?.[1]?.trim()
  if (reason) return reason
  const detail = xml.match(/<(?:s:)?Detail[^>]*>([\s\S]{0,200})/i)?.[1]?.trim()
  return detail ?? null
}

function inferSoapAction(bodyXml: string): string | undefined {
  const m = bodyXml.match(/<(?:m:)?([A-Z][A-Za-z0-9]+)(?:\s|>)/)
  if (!m?.[1]) return undefined
  return `http://schemas.microsoft.com/exchange/services/2006/messages/${m[1]}`
}

function formatEwsHttpError(status: number, xml: string): string {
  const detail =
    extractMessageText(xml) ??
    extractSoapFaultText(xml) ??
    extractResponseCode(xml) ??
    xml.replace(/\s+/g, ' ').slice(0, 400)
  return `EWS HTTP ${status}: ${detail}`
}

export async function postEwsSoap(input: {
  accessToken: string
  anchorMailbox: string
  bodyXml: string
  soapAction?: string
}): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:t="${TYPES_NS}" xmlns:m="${MESSAGES_NS}">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    ${input.bodyXml}
  </soap:Body>
</soap:Envelope>`

  const soapAction = input.soapAction ?? inferSoapAction(input.bodyXml)

  const res = await fetch(EWS_ENDPOINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      Authorization: `Bearer ${input.accessToken}`,
      'X-AnchorMailbox': input.anchorMailbox,
      ...(soapAction ? { SOAPAction: `"${soapAction}"` } : {})
    },
    body: envelope
  })

  const text = await res.text()
  if (!res.ok) {
    throw new EwsRequestError(formatEwsHttpError(res.status, text), extractResponseCode(text) ?? undefined)
  }

  const code = extractResponseCode(text)
  if (code && code !== 'NoError' && code !== 'ErrorItemNotFound') {
    throw new EwsRequestError(
      extractMessageText(text) ?? `EWS ResponseCode ${code}`,
      code
    )
  }

  return text
}

export function itemIdXml(ewsItemId: string): string {
  return `<t:ItemId Id="${escapeXmlText(ewsItemId)}"/>`
}

export function distinguishedFolderIdXml(
  folder: 'inbox' | 'sentitems' | 'drafts' | 'deleteditems' | 'archive' | 'junkemail' | 'outbox'
): string {
  return `<t:DistinguishedFolderId Id="${folder}"/>`
}
