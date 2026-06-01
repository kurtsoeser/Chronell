import type { ComposeReferenceAttachment, MailImportance } from '@shared/types'
import { listAccounts } from '../accounts'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { graphMailboxRoot } from './graph-mailbox-root'
import { isGraphInvalidReferenceItem } from './graph-request-errors'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

async function resolveMailboxRoot(
  accountId: string,
  sendFromEmail?: string | null
): Promise<string> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')
  return graphMailboxRoot(acc.email, sendFromEmail)
}

export interface RecipientInput {
  address: string
  name?: string
}

export interface AttachmentInput {
  name: string
  contentType: string
  /** Base64 (ohne Daten-URL-Prefix). */
  dataBase64: string
  isInline?: boolean
  contentId?: string
}

export interface ComposeMessageInput {
  accountId: string
  subject: string
  bodyHtml: string
  to: RecipientInput[]
  cc?: RecipientInput[]
  bcc?: RecipientInput[]
  attachments?: AttachmentInput[]
  /**
   * Optional: Wenn diese ID gesetzt ist, wird der Send-Call auf
   * /me/messages/{id}/reply bzw. /forward gemappt. Dann setzt Graph
   * automatisch In-Reply-To/References und ordnet die Mail dem Thread zu.
   */
  replyToRemoteId?: string
  replyMode?: 'reply' | 'replyAll' | 'forward'
  importance?: MailImportance
  isDeliveryReceiptRequested?: boolean
  isReadReceiptRequested?: boolean
  referenceAttachments?: ComposeReferenceAttachment[]
  /** Vorhandener Server-Entwurf: PATCH + /send statt neu anlegen. */
  remoteDraftId?: string | null
  /** SMTP-Absender; abweichend = freigegebenes Postfach / Alias. */
  sendFromEmail?: string | null
}

export type SendMailResult = { sentFromExistingDraft: boolean }

function toGraphRecipients(recipients: RecipientInput[]): Array<{
  emailAddress: { address: string; name?: string }
}> {
  return recipients
    .filter((r) => r.address)
    .map((r) => ({
      emailAddress: { address: r.address, ...(r.name ? { name: r.name } : {}) }
    }))
}

interface GraphFileAttachment {
  '@odata.type': '#microsoft.graph.fileAttachment'
  name: string
  contentType: string
  contentBytes: string
  isInline?: boolean
  contentId?: string
}

interface GraphReferenceAttachment {
  '@odata.type': '#microsoft.graph.referenceAttachment'
  name: string
  sourceUrl: string
  providerType: string
}

function toGraphAttachments(atts: AttachmentInput[] | undefined): GraphFileAttachment[] {
  if (!atts || atts.length === 0) return []
  return atts.map((a) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.name,
    contentType: a.contentType,
    contentBytes: a.dataBase64,
    ...(a.isInline ? { isInline: true } : {}),
    ...(a.contentId ? { contentId: a.contentId } : {})
  }))
}

function toGraphReferenceAttachments(
  refs: ComposeReferenceAttachment[] | undefined
): GraphReferenceAttachment[] {
  if (!refs || refs.length === 0) return []
  return refs.map((r) => ({
    '@odata.type': '#microsoft.graph.referenceAttachment',
    name: r.name,
    sourceUrl: r.sourceUrl,
    providerType: r.providerType ?? 'oneDriveBusiness'
  }))
}

function messageFlagPatch(input: ComposeMessageInput): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  if (input.importance && input.importance !== 'normal') {
    o.importance = input.importance
  }
  if (input.isDeliveryReceiptRequested) {
    o.isDeliveryReceiptRequested = true
  }
  if (input.isReadReceiptRequested) {
    o.isReadReceiptRequested = true
  }
  return o
}

function buildBaseMessage(input: ComposeMessageInput): Record<string, unknown> {
  return {
    subject: input.subject,
    body: { contentType: 'HTML' as const, content: input.bodyHtml },
    toRecipients: toGraphRecipients(input.to),
    ccRecipients: toGraphRecipients(input.cc ?? []),
    bccRecipients: toGraphRecipients(input.bcc ?? []),
    ...messageFlagPatch(input)
  }
}

function draftContentPatch(input: ComposeMessageInput): Record<string, unknown> {
  return {
    subject: input.subject,
    body: { contentType: 'HTML' as const, content: input.bodyHtml },
    ...messageFlagPatch(input)
  }
}

function draftRecipientsPatch(input: ComposeMessageInput): Record<string, unknown> {
  return {
    toRecipients: toGraphRecipients(input.to),
    ccRecipients: toGraphRecipients(input.cc ?? []),
    bccRecipients: toGraphRecipients(input.bcc ?? [])
  }
}

/** Reply/ReplyAll-Entwuerfe sind an die Original-Mail gekoppelt — Empfaenger-PATCH schlaegt oft fehl. */
function isLinkedReplyCompose(input: ComposeMessageInput): boolean {
  return Boolean(
    input.replyToRemoteId?.trim() &&
      input.replyMode &&
      input.replyMode !== 'forward'
  )
}

async function graphPatchDraft(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  draftId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await client.api(`${mb}/messages/${draftId}`).patch(patch)
}

/**
 * Aktualisiert einen Entwurf. Bei Reply/ReplyAll zuerst nur Inhalt; Empfaenger nur bei Erfolg.
 * Graph: ErrorInvalidReferenceItem bei PATCH von to/cc/bcc auf gekoppelten Reply-Entwuerfen.
 */
async function graphPatchDraftForCompose(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  draftId: string,
  input: ComposeMessageInput
): Promise<void> {
  const content = draftContentPatch(input)
  if (!isLinkedReplyCompose(input)) {
    await graphPatchDraft(client, mb, draftId, { ...content, ...draftRecipientsPatch(input) })
    return
  }

  try {
    await graphPatchDraft(client, mb, draftId, { ...content, ...draftRecipientsPatch(input) })
  } catch (e) {
    if (!isGraphInvalidReferenceItem(e)) throw e
    await graphPatchDraft(client, mb, draftId, content)
    try {
      await graphPatchDraft(client, mb, draftId, draftRecipientsPatch(input))
    } catch (e2) {
      if (!isGraphInvalidReferenceItem(e2)) throw e2
    }
  }
}

function createReplyEndpoint(
  mb: string,
  replyToRemoteId: string,
  replyMode: 'reply' | 'replyAll' | 'forward'
): string {
  const id = replyToRemoteId.trim()
  if (replyMode === 'forward') return `${mb}/messages/${id}/createForward`
  if (replyMode === 'replyAll') return `${mb}/messages/${id}/createReplyAll`
  return `${mb}/messages/${id}/createReply`
}

async function graphCreateReplyOrForwardDraft(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  input: ComposeMessageInput
): Promise<string> {
  const replyToRemoteId = input.replyToRemoteId!.trim()
  const replyMode = input.replyMode!
  const endpoint = createReplyEndpoint(mb, replyToRemoteId, replyMode)
  const createPayload =
    replyMode === 'forward'
      ? { message: buildBaseMessage(input) }
      : { message: draftContentPatch(input) }

  try {
    const draft = (await client.api(endpoint).post(createPayload)) as { id: string }
    await graphPatchDraftForCompose(client, mb, draft.id, input)
    return draft.id
  } catch (e) {
    if (!isGraphInvalidReferenceItem(e)) throw e
    console.warn(
      `[compose] createReply/Forward fuer ${replyToRemoteId} nicht moeglich — Entwurf ohne Thread-Verknuepfung`
    )
    const draft = (await client.api(`${mb}/messages`).post(buildBaseMessage(input))) as { id: string }
    return draft.id
  }
}

// Graph hat ein hartes Limit von 4 MB pro Request bei sendMail/create.
// Groessere Anhaenge muessen ueber eine Upload-Session am Draft hochgeladen
// werden. Wir uebernehmen alles unter dieser Schwelle inline und laden
// groessere Files separat hoch.
const INLINE_ATTACHMENT_LIMIT = 3 * 1024 * 1024 // 3 MB Sicherheitspuffer

function partitionAttachments(atts: AttachmentInput[] | undefined): {
  inline: AttachmentInput[]
  large: AttachmentInput[]
} {
  const inline: AttachmentInput[] = []
  const large: AttachmentInput[] = []
  for (const a of atts ?? []) {
    const bytes = Math.ceil((a.dataBase64.length * 3) / 4)
    if (bytes > INLINE_ATTACHMENT_LIMIT) large.push(a)
    else inline.push(a)
  }
  return { inline, large }
}

async function uploadLargeAttachment(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  draftId: string,
  att: AttachmentInput
): Promise<void> {
  const buffer = Buffer.from(att.dataBase64, 'base64')
  const session = (await client
    .api(`${mb}/messages/${draftId}/attachments/createUploadSession`)
    .post({
      AttachmentItem: {
        attachmentType: 'file',
        name: att.name,
        size: buffer.byteLength,
        contentType: att.contentType,
        ...(att.isInline ? { isInline: true } : {}),
        ...(att.contentId ? { contentId: att.contentId } : {})
      }
    })) as { uploadUrl: string }

  const chunkSize = 5 * 1024 * 1024 // 5 MB
  for (let start = 0; start < buffer.byteLength; start += chunkSize) {
    const end = Math.min(start + chunkSize, buffer.byteLength)
    const chunk = buffer.subarray(start, end)
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${buffer.byteLength}`
      },
      body: chunk
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Upload des Anhangs fehlgeschlagen (${res.status}): ${txt.slice(0, 200)}`)
    }
  }
}

export async function sendMail(input: ComposeMessageInput): Promise<SendMailResult> {
  const client = await getClientFor(input.accountId)
  const mb = await resolveMailboxRoot(input.accountId, input.sendFromEmail)

  const { inline, large } = partitionAttachments(input.attachments)
  const refAtts = toGraphReferenceAttachments(input.referenceAttachments)
  const hasRefs = refAtts.length > 0

  const baseMessage = buildBaseMessage(input)

  const existingDraft = input.remoteDraftId?.trim()
  if (existingDraft) {
    const draftId = await graphSyncDraftContent(
      client,
      mb,
      input,
      baseMessage,
      existingDraft,
      inline,
      large,
      refAtts
    )
    await client.api(`${mb}/messages/${draftId}/send`).post({})
    return { sentFromExistingDraft: true }
  }

  // ReferenceAttachments und grosse Dateien erfordern Draft-Pfad.
  const needsDraftPath =
    large.length > 0 || (input.replyToRemoteId && input.replyMode) || hasRefs

  if (!needsDraftPath) {
    const fileAtts = toGraphAttachments(inline)
    const messagePayload = {
      ...baseMessage,
      ...(fileAtts.length ? { attachments: fileAtts } : {})
    }
    await client.api(`${mb}/sendMail`).post({
      message: messagePayload,
      saveToSentItems: true
    })
    return { sentFromExistingDraft: false }
  }

  const draftId = await graphCreateFreshDraftId(client, mb, input, baseMessage)
  await graphApplyDraftAttachments(client, mb, draftId, inline, large, refAtts)
  await client.api(`${mb}/messages/${draftId}/send`).post({})
  return { sentFromExistingDraft: false }
}

export interface SaveMailDraftInput extends ComposeMessageInput {
  remoteDraftId?: string | null
}

type DraftAttachmentRow = {
  id: string
  '@odata.type'?: string
  sourceUrl?: string | null
}

async function listDraftAttachmentRows(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  messageId: string
): Promise<DraftAttachmentRow[]> {
  type Page = { value: DraftAttachmentRow[]; ['@odata.nextLink']?: string }
  const out: DraftAttachmentRow[] = []
  let url: string | null = `${mb}/messages/${messageId}/attachments?$top=100`
  while (url) {
    const page = (await client.api(url).get()) as Page
    out.push(...(page.value ?? []))
    const next = page['@odata.nextLink'] ?? null
    url = next ? next.replace(/^https?:\/\/[^/]+\/v[0-9.]+/, '') : null
  }
  return out
}

/** Nur Dateianhänge entfernen — referenceAttachment löschen löst ErrorInvalidReferenceItem aus. */
async function graphDeleteDraftFileAttachments(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  messageId: string
): Promise<void> {
  const rows = await listDraftAttachmentRows(client, mb, messageId)
  for (const a of rows) {
    if (a['@odata.type'] !== '#microsoft.graph.fileAttachment') continue
    try {
      await client.api(`${mb}/messages/${messageId}/attachments/${a.id}`).delete()
    } catch (e) {
      if (!isGraphInvalidReferenceItem(e)) throw e
    }
  }
}

async function graphCreateFreshDraftId(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  input: ComposeMessageInput,
  baseMessage: Record<string, unknown>
): Promise<string> {
  if (input.replyToRemoteId && input.replyMode) {
    return graphCreateReplyOrForwardDraft(client, mb, input)
  }
  const draft = (await client.api(`${mb}/messages`).post(baseMessage)) as { id: string }
  return draft.id
}

/** PATCH + Anhaenge; bei inkompatiblem Server-Entwurf neu anlegen. */
async function graphSyncDraftContent(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  input: ComposeMessageInput,
  baseMessage: Record<string, unknown>,
  remoteDraftId: string,
  inline: AttachmentInput[],
  large: AttachmentInput[],
  refAtts: GraphReferenceAttachment[]
): Promise<string> {
  try {
    await graphPatchDraftForCompose(client, mb, remoteDraftId, input)
    await graphDeleteDraftFileAttachments(client, mb, remoteDraftId)
    await graphApplyDraftAttachments(client, mb, remoteDraftId, inline, large, refAtts)
    return remoteDraftId
  } catch (e) {
    if (!isGraphInvalidReferenceItem(e)) throw e
    console.warn(`[compose] Server-Entwurf ${remoteDraftId} nicht aktualisierbar — neu anlegen`)
    const draftId = await graphCreateFreshDraftId(client, mb, input, baseMessage)
    await graphApplyDraftAttachments(client, mb, draftId, inline, large, refAtts)
    return draftId
  }
}

async function graphApplyDraftAttachments(
  client: ReturnType<typeof createGraphClient>,
  mb: string,
  draftId: string,
  inline: AttachmentInput[],
  large: AttachmentInput[],
  refAtts: GraphReferenceAttachment[]
): Promise<void> {
  for (const att of inline) {
    await client.api(`${mb}/messages/${draftId}/attachments`).post(toGraphAttachments([att])[0])
  }
  for (const att of large) {
    await uploadLargeAttachment(client, mb, draftId, att)
  }
  if (refAtts.length === 0) return

  const existing = await listDraftAttachmentRows(client, mb, draftId)
  const existingRefUrls = new Set(
    existing
      .filter((a) => a['@odata.type'] === '#microsoft.graph.referenceAttachment')
      .map((a) => a.sourceUrl?.trim().toLowerCase())
      .filter((u): u is string => Boolean(u))
  )
  for (const ref of refAtts) {
    const url = ref.sourceUrl?.trim().toLowerCase()
    if (url && existingRefUrls.has(url)) continue
    await client.api(`${mb}/messages/${draftId}/attachments`).post(ref)
    if (url) existingRefUrls.add(url)
  }
}

/**
 * Legt einen Entwurf in «Entwürfe» an oder aktualisiert ihn (PATCH + Anhänge neu setzen).
 * Kein Senden.
 */
export async function saveMailDraft(input: SaveMailDraftInput): Promise<{ remoteDraftId: string }> {
  const client = await getClientFor(input.accountId)
  const mb = await resolveMailboxRoot(input.accountId, input.sendFromEmail)
  const { inline, large } = partitionAttachments(input.attachments)
  const refAtts = toGraphReferenceAttachments(input.referenceAttachments)
  const baseMessage = buildBaseMessage(input)

  const rem = input.remoteDraftId?.trim()
  if (rem) {
    const draftId = await graphSyncDraftContent(
      client,
      mb,
      input,
      baseMessage,
      rem,
      inline,
      large,
      refAtts
    )
    return { remoteDraftId: draftId }
  }

  const draftId = await graphCreateFreshDraftId(client, mb, input, baseMessage)
  await graphApplyDraftAttachments(client, mb, draftId, inline, large, refAtts)
  return { remoteDraftId: draftId }
}
