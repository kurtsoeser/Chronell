import { ResponseType } from '@microsoft/microsoft-graph-client'
import type { ComposeAttachment, MailFull } from '@shared/types'
import { listAccounts } from './accounts'
import { isDemoAccount } from './demo/demo-accounts'
import { getMessageById } from './db/messages-repo'
import { shouldUseEwsForMicrosoftMail } from './ews/microsoft-mail-transport'
import { postEwsSoap, itemIdXml, EwsRequestError } from './ews/ews-soap'
import { translateRestIdToEwsId } from './ews/translate-exchange-ids'
import { createGraphClient } from './graph/client'
import { runGraphMailboxRequest } from './graph/graph-account-request'
import { getGoogleApis } from './google/google-auth-client'
import { sanitizeFileName } from './ipc/ipc-helpers'
import { ensureMessageBodyLoaded } from './message-body-fetch'
import { loadConfig } from './config'
import { acquireEwsAccessToken } from './auth/microsoft-ews'

function emlFileNameFromSubject(subject: string | null | undefined): string {
  const base = sanitizeFileName(subject?.trim() || 'Nachricht')
  const stem = base.replace(/\.eml$/i, '') || 'Nachricht'
  return `${stem}.eml`
}

function foldHeaderValue(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

function buildFallbackEmlBytes(msg: MailFull): Buffer {
  const subject = foldHeaderValue(msg.subject ?? '')
  const from = foldHeaderValue(
    msg.fromName?.trim() && msg.fromAddr?.trim()
      ? `${msg.fromName.trim()} <${msg.fromAddr.trim()}>`
      : msg.fromAddr?.trim() || msg.fromName?.trim() || 'unknown@invalid'
  )
  const to = foldHeaderValue(msg.toAddrs ?? '')
  const cc = foldHeaderValue(msg.ccAddrs ?? '')
  const date = new Date(msg.receivedAt || msg.sentAt || Date.now()).toUTCString()
  const html = msg.bodyHtml?.trim()
  const text =
    msg.bodyText?.trim() ||
    (html
      ? html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '')

  const headers = [
    `From: ${from}`,
    ...(to ? [`To: ${to}`] : []),
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    `Date: ${date}`,
    'MIME-Version: 1.0'
  ]

  if (html) {
    const boundary = `----=_MailClient_${Date.now()}`
    const body = [
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      text || subject || '(Kein Inhalt)',
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '',
      `--${boundary}--`,
      ''
    ].join('\r\n')
    return Buffer.from(`${headers.join('\r\n')}\r\n${body}`, 'utf8')
  }

  const body = [
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || subject || '(Kein Inhalt)',
    ''
  ].join('\r\n')
  return Buffer.from(`${headers.join('\r\n')}\r\n${body}`, 'utf8')
}

async function fetchGraphMessageMimeBytes(
  accountId: string,
  remoteMessageId: string
): Promise<Buffer> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  const client = createGraphClient(config.microsoftClientId, homeAccountId)
  const mime = (await runGraphMailboxRequest(accountId, 'getMessageMimeForExport', () =>
    client
      .api(`/me/messages/${remoteMessageId}/$value`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get()
  )) as ArrayBuffer
  return Buffer.from(mime)
}

async function fetchGmailMessageRawBytes(
  accountId: string,
  remoteMessageId: string
): Promise<Buffer> {
  const { gmail } = await getGoogleApis(accountId)
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: remoteMessageId,
    format: 'raw'
  })
  const raw = res.data.raw?.trim()
  if (!raw) throw new Error('Gmail-Rohtext fehlt.')
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

async function fetchEwsMessageMimeBytes(
  accountId: string,
  remoteMessageId: string
): Promise<Buffer | null> {
  const config = await loadConfig()
  if (!config.microsoftClientId) throw new Error('Keine Azure Client-ID konfiguriert.')
  const token = await acquireEwsAccessToken(config.microsoftClientId, accountId)
  const accounts = await listAccounts()
  const email = accounts.find((a) => a.id === accountId)?.email?.trim()
  if (!email) throw new Error('Konto-E-Mail fuer EWS nicht gefunden.')

  const ewsItemId = await translateRestIdToEwsId(accountId, remoteMessageId)
  let xml: string
  try {
    xml = await postEwsSoap({
      accessToken: token,
      anchorMailbox: email,
      bodyXml: `<m:GetItem>
  <m:ItemShape>
    <t:BaseShape>IdOnly</t:BaseShape>
    <t:IncludeMimeContent>true</t:IncludeMimeContent>
  </m:ItemShape>
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:GetItem>`
    })
  } catch (e) {
    if (e instanceof EwsRequestError && e.responseCode === 'ErrorItemNotFound') {
      return null
    }
    throw e
  }

  const match = xml.match(/<t:MimeContent[^>]*>([\s\S]*?)<\/t:MimeContent>/i)
  const b64 = match?.[1]?.replace(/\s+/g, '').trim()
  if (!b64) return null
  return Buffer.from(b64, 'base64')
}

function toComposeAttachment(msg: MailFull, bytes: Buffer): ComposeAttachment {
  return {
    name: emlFileNameFromSubject(msg.subject),
    contentType: 'message/rfc822',
    size: bytes.length,
    dataBase64: bytes.toString('base64')
  }
}

/** Erzeugt einen .eml-Anhang aus einer lokal gespeicherten Mail (Provider-Rohtext oder Fallback). */
export async function buildMailEmlAttachment(messageId: number): Promise<ComposeAttachment | null> {
  const loaded = await ensureMessageBodyLoaded(messageId)
  const msg = loaded ?? getMessageById(messageId)
  if (!msg) return null

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === msg.accountId)
  if (!acc || isDemoAccount(acc)) {
    return toComposeAttachment(msg, buildFallbackEmlBytes(msg))
  }

  const remoteId = msg.remoteId?.trim()
  if (!remoteId) {
    return toComposeAttachment(msg, buildFallbackEmlBytes(msg))
  }

  let bytes: Buffer | null = null
  try {
    if (acc.provider === 'google') {
      bytes = await fetchGmailMessageRawBytes(acc.id, remoteId)
    } else if (acc.provider === 'microsoft') {
      if (await shouldUseEwsForMicrosoftMail(acc.id)) {
        bytes = await fetchEwsMessageMimeBytes(acc.id, remoteId)
      } else {
        bytes = await fetchGraphMessageMimeBytes(acc.id, remoteId)
      }
    }
  } catch (e) {
    console.warn('[mail-eml-export] Provider-MIME konnte nicht geladen werden:', messageId, e)
  }

  if (!bytes || bytes.length === 0) {
    bytes = buildFallbackEmlBytes(msg)
  }

  return toComposeAttachment(msg, bytes)
}
