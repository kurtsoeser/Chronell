import { ipcMain } from 'electron'
import {
  IPC,
  type ComposeSendInput,
  type ComposeSaveDraftInput,
  type ComposeSaveDraftResult,
  type ComposeDisposeDraftInput,
  type ComposeSendResult,
  type ComposeRecipientSuggestion,
  type ComposeListDriveExplorerInput,
  type ComposeDriveExplorerEntry,
  type ComposeDriveExplorerScope,
  type ComposeDriveExplorerNavCrumb,
  type ComposeDriveExplorerFavorite,
  type ComposeSendFromOption,
  type ComposeCreateDriveSharingLinkInput,
  type ComposeCreateDriveSharingLinkResult,
  type ComposeDriveSharingLinkScope,
  type ComposeDriveSharingLinkType
} from '@shared/types'
import { listAccounts } from '../accounts'
import { gmailSendMail, gmailSaveDraft } from '../google/gmail-compose'
import { insertScheduledCompose } from '../db/compose-scheduled-repo'
import { searchPeopleContactsForCompose, listBootstrapPeopleContactsForCompose } from '../db/people-repo'
import { sendMail as graphSendMail, saveMailDraft as graphSaveMailDraft } from '../graph/compose'
import { listComposeSendFromOptions } from '../graph/compose-send-from'
import {
  graphListDriveExplorer,
  graphSearchPeopleForCompose,
  graphSearchDirectoryUsersForCompose,
  graphSearchMailEnabledGroupsForCompose
} from '../graph/compose-recipient-graph'
import { graphCreateDriveSharingLink } from '../graph/drive-sharing-link'
import {
  isCompleteEmailQuery,
  normalizeRecipientSuggestionQuery
} from '@shared/compose-recipient-query'
import {
  addDriveExplorerFavorite,
  listDriveExplorerFavorites,
  removeDriveExplorerFavorite,
  updateDriveExplorerFavoriteCache,
  renameDriveExplorerFavorite,
  reorderDriveExplorerFavorites
} from '../drive-explorer-favorites-store'
import { setWaitingForMessage } from '../waiting-service'
import { assertAppOnline } from '../network-status'
import { findFolderByWellKnown } from '../db/folders-repo'
import { runFolderSync } from '../sync-runner'
import { disposeComposeDraft } from '../compose-draft-dispose'
import {
  findRecentSentMessageId,
  listRecentParticipantEmailsForCompose,
  searchMessageParticipantEmails
} from '../db/messages-repo'
import { parseDriveExplorerScope, parseDriveExplorerNavCrumbs, parseDriveExplorerEntries } from './register-mail-ipc-parse'

export function registerMailComposeIpc(): void {
  ipcMain.handle(
    IPC.compose.send,
    async (_event, input: ComposeSendInput): Promise<ComposeSendResult> => {
      if (!input.accountId) throw new Error('Kein Konto ausgewaehlt.')
      if (input.to.length === 0) throw new Error('Mindestens ein Empfaenger erforderlich.')
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === input.accountId)
      if (!acc) throw new Error('Konto nicht gefunden.')

      if (input.referenceAttachments?.length && acc.provider === 'google') {
        throw new Error('Cloud-Anhaenge (OneDrive) sind nur fuer Microsoft 365 verfuegbar.')
      }

      const scheduleRaw = input.scheduledSendAt?.trim()
      if (scheduleRaw) {
        const when = Date.parse(scheduleRaw)
        if (!Number.isNaN(when) && when > Date.now() + 15_000) {
          const attBytes = (input.attachments ?? []).reduce((s, a) => s + (a.size ?? 0), 0)
          if (attBytes > 10 * 1024 * 1024) {
            throw new Error('Geplanter Versand: Dateianhaenge insgesamt max. ca. 10 MB.')
          }
          const { scheduledSendAt: _drop, ...queued } = input
          insertScheduledCompose(queued, new Date(when).toISOString())
          return { messageId: null }
        }
      }

      let draftConsumedOnSend = false
      if (acc.provider === 'google') {
        const r = await gmailSendMail(
          {
            accountId: input.accountId,
            subject: input.subject,
            bodyHtml: input.bodyHtml,
            to: input.to,
            cc: input.cc,
            bcc: input.bcc,
            attachments: input.attachments,
            replyToRemoteId: input.replyToRemoteId,
            replyMode: input.replyMode,
            remoteDraftId: input.remoteDraftId
          },
          acc.email,
          acc.displayName
        )
        draftConsumedOnSend = r.sentFromExistingDraft
      } else {
        const r = await graphSendMail({
          accountId: input.accountId,
          sendFromEmail: input.sendFromEmail,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          attachments: input.attachments,
          replyToRemoteId: input.replyToRemoteId,
          replyMode: input.replyMode,
          importance: input.importance,
          isDeliveryReceiptRequested: input.isDeliveryReceiptRequested,
          isReadReceiptRequested: input.isReadReceiptRequested,
          referenceAttachments: input.referenceAttachments,
          remoteDraftId: input.remoteDraftId
        })
        draftConsumedOnSend = r.sentFromExistingDraft
      }

      if (input.remoteDraftId?.trim() || input.linkedMessageId != null) {
        await disposeComposeDraft({
          accountId: input.accountId,
          remoteDraftId: input.remoteDraftId,
          linkedMessageId: input.linkedMessageId,
          draftConsumedOnSend
        })
      }

      if (
        input.trackWaitingOnMessageId != null &&
        input.expectReplyInDays != null &&
        input.expectReplyInDays > 0
      ) {
        try {
          setWaitingForMessage(input.trackWaitingOnMessageId, input.expectReplyInDays)
        } catch (e) {
          console.warn('[ipc] compose.send: Waiting-for nach Senden:', e)
        }
      }

      // Gesendete Mails landen in «Gesendet» — Sync abwarten, damit die Canvas-Platzierung die ID findet.
      const sentFolder = findFolderByWellKnown(input.accountId, 'sentitems')
      let messageId: number | null = null
      if (sentFolder) {
        try {
          await runFolderSync(sentFolder.id)
        } catch {
          /* Sync-Fehler: Platzierung versucht trotzdem Fallback */
        }
        messageId = findRecentSentMessageId(input.accountId, input.subject)
      }
      return { messageId }
    }
  )

  ipcMain.handle(
    IPC.compose.saveDraft,
    async (_event, input: ComposeSaveDraftInput): Promise<ComposeSaveDraftResult> => {
      if (!input.accountId) throw new Error('Kein Konto ausgewaehlt.')
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === input.accountId)
      if (!acc) throw new Error('Konto nicht gefunden.')

      if (input.referenceAttachments?.length && acc.provider === 'google') {
        throw new Error('Cloud-Anhaenge (OneDrive) sind nur fuer Microsoft 365 verfuegbar.')
      }

      const toRecipients = input.to.map((r) => ({
        address: r.address.trim(),
        ...(r.name?.trim() ? { name: r.name.trim() } : {})
      }))
      const ccRecipients = (input.cc ?? []).map((r) => ({
        address: r.address.trim(),
        ...(r.name?.trim() ? { name: r.name.trim() } : {})
      }))
      const bccRecipients = (input.bcc ?? []).map((r) => ({
        address: r.address.trim(),
        ...(r.name?.trim() ? { name: r.name.trim() } : {})
      }))
      const attachments = input.attachments?.map((a) => ({
        name: a.name,
        contentType: a.contentType,
        dataBase64: a.dataBase64,
        ...(a.isInline ? { isInline: true as const } : {}),
        ...(a.contentId ? { contentId: a.contentId } : {})
      }))

      let result: ComposeSaveDraftResult
      if (acc.provider === 'google') {
        const r = await gmailSaveDraft(
          {
            accountId: input.accountId,
            subject: input.subject,
            bodyHtml: input.bodyHtml,
            to: toRecipients,
            cc: ccRecipients.length ? ccRecipients : undefined,
            bcc: bccRecipients.length ? bccRecipients : undefined,
            attachments,
            replyToRemoteId: input.replyToRemoteId,
            replyMode: input.replyMode,
            remoteDraftId: input.remoteDraftId
          },
          acc.email,
          acc.displayName ?? ''
        )
        result = { remoteDraftId: r.remoteDraftId }
      } else {
        result = await graphSaveMailDraft({
          accountId: input.accountId,
          sendFromEmail: input.sendFromEmail,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          to: toRecipients,
          cc: ccRecipients.length ? ccRecipients : undefined,
          bcc: bccRecipients.length ? bccRecipients : undefined,
          attachments,
          replyToRemoteId: input.replyToRemoteId,
          replyMode: input.replyMode,
          referenceAttachments: input.referenceAttachments,
          importance: input.importance,
          isDeliveryReceiptRequested: input.isDeliveryReceiptRequested,
          isReadReceiptRequested: input.isReadReceiptRequested,
          remoteDraftId: input.remoteDraftId
        })
      }

      const draftsFolder = findFolderByWellKnown(input.accountId, 'drafts')
      if (draftsFolder) {
        void runFolderSync(draftsFolder.id).catch(() => undefined)
      }
      return result
    }
  )

  ipcMain.handle(
    IPC.compose.disposeDraft,
    async (_event, input: ComposeDisposeDraftInput): Promise<void> => {
      if (!input.accountId?.trim()) return
      await disposeComposeDraft({
        accountId: input.accountId,
        remoteDraftId: input.remoteDraftId,
        linkedMessageId: input.linkedMessageId
      })
    }
  )

  ipcMain.handle(
    IPC.compose.listSendFromOptions,
    async (_event, args: { accountId: string }): Promise<ComposeSendFromOption[]> => {
      const accountId = typeof args?.accountId === 'string' ? args.accountId.trim() : ''
      if (!accountId) return []
      return listComposeSendFromOptions(accountId)
    }
  )

  ipcMain.handle(
    IPC.compose.recipientSuggestions,
    async (
      _event,
      args: { accountId: string; query: string }
    ): Promise<ComposeRecipientSuggestion[]> => {
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === args.accountId)
      if (!acc) return []
      const q = normalizeRecipientSuggestionQuery(args.query)
      const limit = 16
      const seen = new Set<string>()
      const out: ComposeRecipientSuggestion[] = []

      const push = (s: ComposeRecipientSuggestion): void => {
        const k = s.email.trim().toLowerCase()
        if (!k || seen.has(k)) return
        seen.add(k)
        out.push(s)
      }

      if (q.length === 0) {
        for (const r of listBootstrapPeopleContactsForCompose({
          accountId: args.accountId,
          limit: 10
        })) {
          push({
            email: r.email,
            displayName: r.displayName,
            source: 'people-local'
          })
          if (out.length >= limit) return out
        }
        for (const r of listRecentParticipantEmailsForCompose({
          accountId: args.accountId,
          limit: 10
        })) {
          push({
            email: r.email,
            displayName: r.displayName,
            source: 'mail-history'
          })
          if (out.length >= limit) return out
        }
        return out
      }

      for (const r of searchPeopleContactsForCompose({
        accountId: args.accountId,
        needle: q,
        limit
      })) {
        push({
          email: r.email,
          displayName: r.displayName,
          source: 'people-local'
        })
        if (out.length >= limit) return out
      }

      for (const r of searchMessageParticipantEmails({
        accountId: args.accountId,
        needle: q,
        limit
      })) {
        push({
          email: r.email,
          displayName: r.displayName,
          source: 'mail-history'
        })
        if (out.length >= limit) return out
      }

      if (isCompleteEmailQuery(q)) {
        const email = normalizeRecipientSuggestionQuery(q)
        const nameMatch = args.query.trim().match(/^(.*?)<[^>]+>\s*$/)
        const displayName = nameMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || undefined
        push({
          email,
          displayName: displayName || null,
          source: 'people-local'
        })
        if (out.length >= limit) return out
      }

      if (acc.provider === 'microsoft') {
        try {
          for (const r of await graphSearchPeopleForCompose(args.accountId, q, 8)) {
            push(r)
            if (out.length >= limit) return out
          }
          if (q.length >= 2 && !isCompleteEmailQuery(q)) {
            for (const r of await graphSearchDirectoryUsersForCompose(args.accountId, q, 6)) {
              push(r)
              if (out.length >= limit) return out
            }
            for (const r of await graphSearchMailEnabledGroupsForCompose(args.accountId, q, 5)) {
              push(r)
              if (out.length >= limit) return out
            }
          }
        } catch (e) {
          console.warn('[ipc] compose.recipientSuggestions graph:', e)
        }
      }

      return out
    }
  )

  ipcMain.handle(
    IPC.compose.listDriveExplorer,
    async (_event, raw: unknown): Promise<ComposeDriveExplorerEntry[]> => {
      try {
        const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
        const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
        if (!accountId) {
          throw new Error('Kein Konto fuer OneDrive ausgewaehlt.')
        }
        const scopeRaw = o.scope
        const scope =
          scopeRaw === 'recent' || scopeRaw === 'myfiles' || scopeRaw === 'shared' || scopeRaw === 'sharepoint'
            ? scopeRaw
            : 'myfiles'
        const folderId =
          typeof o.folderId === 'string'
            ? o.folderId.trim() || null
            : o.folderId === null
              ? null
              : undefined
        const folderDriveId =
          typeof o.folderDriveId === 'string'
            ? o.folderDriveId.trim() || null
            : o.folderDriveId === null
              ? null
              : undefined
        const siteId =
          typeof o.siteId === 'string'
            ? o.siteId.trim() || null
            : o.siteId === null
              ? null
              : undefined
        const accounts = await listAccounts()
        const acc = accounts.find((a) => a.id === accountId)
        if (!acc) {
          throw new Error('Konto nicht gefunden oder nicht mehr angemeldet.')
        }
        if (acc.provider !== 'microsoft') {
          throw new Error('OneDrive steht nur fuer Microsoft-365-Konten zur Verfuegung.')
        }
        return await graphListDriveExplorer(
          accountId,
          scope,
          folderId ?? null,
          folderDriveId ?? null,
          siteId ?? null
        )
      } catch (e) {
        console.warn('[ipc] compose.listDriveExplorer:', e)
        throw e instanceof Error ? e : new Error(String(e))
      }
    }
  )

  ipcMain.handle(
    IPC.compose.listDriveExplorerFavorites,
    async (_event, raw: unknown): Promise<ComposeDriveExplorerFavorite[]> => {
      try {
        const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
        const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
        if (!accountId) return []
        const accounts = await listAccounts()
        const acc = accounts.find((a) => a.id === accountId)
        if (!acc || acc.provider !== 'microsoft') return []
        return await listDriveExplorerFavorites(accountId)
      } catch (e) {
        console.warn('[ipc] compose.listDriveExplorerFavorites:', e)
        return []
      }
    }
  )

  ipcMain.handle(
    IPC.compose.addDriveExplorerFavorite,
    async (_event, raw: unknown): Promise<ComposeDriveExplorerFavorite> => {
      const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
      if (!accountId) {
        throw new Error('Kein Konto.')
      }
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc) {
        throw new Error('Konto nicht gefunden oder nicht mehr angemeldet.')
      }
      if (acc.provider !== 'microsoft') {
        throw new Error('Favoriten sind nur fuer Microsoft-365-Konten verfuegbar.')
      }
      const scope = parseDriveExplorerScope(o.scope)
      if (!scope) {
        throw new Error('Ungueltiger Explorer-Bereich.')
      }
      const crumbs = parseDriveExplorerNavCrumbs(o.crumbs)
      const label = typeof o.label === 'string' ? o.label : o.label === null ? null : undefined
      const cached = parseDriveExplorerEntries(o.cachedEntries)
      try {
        return await addDriveExplorerFavorite(accountId, scope, crumbs, label ?? null, cached)
      } catch (e) {
        console.warn('[ipc] compose.addDriveExplorerFavorite:', e)
        throw e instanceof Error ? e : new Error(String(e))
      }
    }
  )

  ipcMain.handle(IPC.compose.removeDriveExplorerFavorite, async (_event, raw: unknown): Promise<void> => {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    if (!accountId || !id) return
    try {
      await removeDriveExplorerFavorite(accountId, id)
    } catch (e) {
      console.warn('[ipc] compose.removeDriveExplorerFavorite:', e)
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle(
    IPC.compose.updateDriveExplorerFavoriteCache,
    async (_event, raw: unknown): Promise<void> => {
      const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const entries = parseDriveExplorerEntries(o.entries)
      if (!accountId || !id || !entries) return
      try {
        await updateDriveExplorerFavoriteCache(accountId, id, entries)
      } catch (e) {
        console.warn('[ipc] compose.updateDriveExplorerFavoriteCache:', e)
      }
    }
  )

  ipcMain.handle(IPC.compose.renameDriveExplorerFavorite, async (_event, raw: unknown): Promise<void> => {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    const label = typeof o.label === 'string' ? o.label : ''
    if (!accountId || !id) return
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc || acc.provider !== 'microsoft') {
      throw new Error('Favoriten sind nur fuer Microsoft-365-Konten verfuegbar.')
    }
    try {
      await renameDriveExplorerFavorite(accountId, id, label)
    } catch (e) {
      console.warn('[ipc] compose.renameDriveExplorerFavorite:', e)
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle(IPC.compose.reorderDriveExplorerFavorites, async (_event, raw: unknown): Promise<void> => {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
    const rawIds = o.orderedIds
    if (!accountId || !Array.isArray(rawIds)) return
    const orderedIds = rawIds
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x) => x.length > 0)
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc || acc.provider !== 'microsoft') return
    try {
      await reorderDriveExplorerFavorites(accountId, orderedIds)
    } catch (e) {
      console.warn('[ipc] compose.reorderDriveExplorerFavorites:', e)
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle(
    IPC.compose.createDriveSharingLink,
    async (_event, raw: unknown): Promise<ComposeCreateDriveSharingLinkResult> => {
      const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
      const itemId = typeof o.itemId === 'string' ? o.itemId.trim() : ''
      if (!accountId || !itemId) {
        throw new Error('Konto oder Datei-ID fehlt.')
      }
      const typeRaw = o.type
      const type: ComposeDriveSharingLinkType =
        typeRaw === 'edit' ? 'edit' : 'view'
      const scopeRaw = o.scope
      const scope: ComposeDriveSharingLinkScope =
        scopeRaw === 'anonymous' ? 'anonymous' : 'organization'
      const driveId =
        typeof o.driveId === 'string' ? o.driveId.trim() || null : o.driveId === null ? null : undefined
      const expirationDateTime =
        typeof o.expirationDateTime === 'string'
          ? o.expirationDateTime.trim() || null
          : o.expirationDateTime === null
            ? null
            : undefined

      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc) {
        throw new Error('Konto nicht gefunden oder nicht mehr angemeldet.')
      }
      if (acc.provider !== 'microsoft') {
        throw new Error('Freigabe-Links sind nur fuer Microsoft-365-Konten verfuegbar.')
      }

      return await graphCreateDriveSharingLink({
        accountId,
        itemId,
        driveId,
        type,
        scope,
        ...(expirationDateTime ? { expirationDateTime } : {})
      })
    }
  )
}

