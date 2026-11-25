import type { MailFull } from '@shared/types'
import type {
  OneNoteCatalog,
  OneNoteSendMailInput,
  OneNoteSendMailResult
} from '@shared/types/onenote'
import { buildOneNoteMailPageHtml } from '@shared/onenote-page-html'
import { listAccounts } from '../accounts'
import { getMessageById } from '../db/messages-repo-ops'
import {
  createOneNotePage,
  ensureOneNoteSection,
  loadOneNoteGraphCatalog
} from '../graph/onenote-graph'
import { resolveMailWebLink } from '../notion/mail-web-link'
import { readOneNoteRecent, touchOneNoteDestination } from './onenote-destinations-store'

async function resolveOneNoteAccount(
  messageAccountId: string
): Promise<{ accountId: string; email: string }> {
  const accounts = await listAccounts()
  const mailAccount = accounts.find((account) => account.id === messageAccountId)
  if (mailAccount?.provider === 'microsoft') {
    return { accountId: mailAccount.id, email: mailAccount.email }
  }
  const microsoft = accounts.find((account) => account.provider === 'microsoft')
  if (!microsoft) {
    throw new Error('OneNote braucht ein verbundenes Microsoft-Konto.')
  }
  return { accountId: microsoft.id, email: microsoft.email }
}

function requireMail(messageId: number): MailFull {
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new Error('messageId fehlt')
  }
  const mail = getMessageById(messageId)
  if (!mail) throw new Error('Mail nicht gefunden.')
  return mail
}

function formatMailDate(mail: MailFull): string | null {
  const iso = mail.receivedAt || mail.sentAt
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' })
}

export async function listOneNoteCatalogForMail(messageId: number): Promise<OneNoteCatalog> {
  const mail = requireMail(messageId)
  const account = await resolveOneNoteAccount(mail.accountId)
  const graph = await loadOneNoteGraphCatalog(account.accountId)
  const recent = await readOneNoteRecent()
  return {
    accountId: account.accountId,
    accountEmail: account.email,
    notebooks: graph.notebooks,
    sections: graph.sections,
    opened: graph.opened,
    recent
  }
}

export async function sendMailToOneNote(
  input: OneNoteSendMailInput
): Promise<OneNoteSendMailResult> {
  const mail = requireMail(Number(input.messageId))
  const notebookId = String(input.notebookId || '').trim()
  if (!notebookId) throw new Error('Notizbuch fehlt.')
  const account = await resolveOneNoteAccount(mail.accountId)
  const section = await ensureOneNoteSection(
    account.accountId,
    notebookId,
    input.sectionId,
    input.sectionName
  )

  let webLink: string | null = null
  try {
    webLink = await resolveMailWebLink(mail)
  } catch (err) {
    console.warn(
      '[onenote] Mail-Link nicht ermittelt:',
      err instanceof Error ? err.message : err
    )
  }

  const html = buildOneNoteMailPageHtml({
    subject: mail.subject,
    fromName: mail.fromName,
    fromAddr: mail.fromAddr,
    toAddrs: mail.toAddrs ?? null,
    ccAddrs: mail.ccAddrs,
    dateLabel: formatMailDate(mail),
    webLink,
    bodyText: mail.bodyText,
    bodyHtml: mail.bodyHtml,
    hasAttachments: mail.hasAttachments
  })
  const page = await createOneNotePage({
    accountId: account.accountId,
    sectionId: section.id,
    html
  })

  const notebookName = input.notebookName?.trim() || notebookId
  const sectionName = section.name || input.sectionName?.trim() || section.id
  await touchOneNoteDestination({
    notebookId,
    sectionId: section.id,
    notebookName,
    sectionName
  })

  return {
    notebookId,
    sectionId: section.id,
    notebookName,
    sectionName,
    pageId: page.pageId,
    webUrl: page.webUrl,
    clientUrl: page.clientUrl,
    hasAttachments: mail.hasAttachments
  }
}
