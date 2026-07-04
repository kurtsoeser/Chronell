import type { CloudFileRow, MailFileIndexRow } from '@shared/files'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { ConnectedAccount } from '@shared/types'
import { useComposeStore, type ComposeAttachmentFile, type ComposeReferenceAttachmentDraft } from '@/stores/compose'
import { useAppModeStore } from '@/stores/app-mode'
import { useFilesContextUiStore } from '@/stores/files-context-ui'
import { useUndoStore } from '@/stores/undo'
import { showAppConfirm, showAppPrompt } from '@/stores/app-dialog'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import i18n from '@/i18n'

function t(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, opts)
}

function pushToast(label: string, variant: 'success' | 'error' = 'success'): void {
  useUndoStore.getState().pushToast({ label, variant })
}

function defaultAccountId(
  accounts: ConnectedAccount[],
  preferred?: string
): string | null {
  if (preferred && accounts.some((a) => a.id === preferred)) return preferred
  const ms = accounts.find((a) => a.provider === 'microsoft')
  if (ms) return ms.id
  return accounts[0]?.id ?? null
}

function openComposeWithAttachments(args: {
  accountId: string
  subject: string
  attachments?: ComposeAttachmentFile[]
  referenceAttachments?: ComposeReferenceAttachmentDraft[]
}): void {
  useComposeStore.getState().openFloatingNew(args.accountId)
  const draftId = useComposeStore.getState().activeId
  if (!draftId) return
  useComposeStore.getState().update(draftId, {
    subject: args.subject,
    ...(args.referenceAttachments?.length
      ? { referenceAttachments: args.referenceAttachments }
      : {})
  })
  if (args.attachments?.length) {
    useComposeStore.getState().addAttachments(draftId, args.attachments)
  }
  useAppModeStore.getState().setMode('mail')
}

export async function filesContextOpenMail(row: MailFileIndexRow): Promise<void> {
  await window.mailClient.files.openMailAttachment({ fileId: row.id })
}

export async function filesContextSaveMailAs(row: MailFileIndexRow): Promise<void> {
  await window.mailClient.files.saveMailAttachmentAs({
    fileId: row.id,
    suggestedName: row.name
  })
}

export async function filesContextSendMailAsAttachment(
  row: MailFileIndexRow,
  accounts: ConnectedAccount[]
): Promise<void> {
  const accountId = defaultAccountId(accounts, row.accountId)
  if (!accountId) {
    pushToast(t('files.context.noAccount'), 'error')
    return
  }
  const data = await window.mailClient.files.readMailAttachmentBytes({ fileId: row.id })
  if (!data.ok || !data.dataBase64) {
    pushToast(data.error ?? t('files.context.attachFailed'), 'error')
    return
  }
  openComposeWithAttachments({
    accountId,
    subject: row.name,
    attachments: [
      {
        id: `att-${Date.now()}`,
        name: data.name ?? row.name,
        size: row.size ?? 0,
        contentType: data.contentType ?? row.mime ?? 'application/octet-stream',
        dataBase64: data.dataBase64
      }
    ]
  })
}

export async function filesContextSendCloudAsAttachment(
  row: CloudFileRow,
  accounts: ConnectedAccount[]
): Promise<void> {
  const url = row.webUrl?.trim()
  if (!url) {
    pushToast(t('files.cloud.noWebUrl'), 'error')
    return
  }
  const accountId = defaultAccountId(accounts, row.accountId)
  if (!accountId) {
    pushToast(t('files.context.noAccount'), 'error')
    return
  }
  openComposeWithAttachments({
    accountId,
    subject: row.name,
    referenceAttachments: [
      {
        id: `cref-${Date.now()}`,
        name: row.name,
        webUrl: url
      }
    ]
  })
}

export async function filesContextRenameCloud(
  row: CloudFileRow,
  onRenamed?: () => void
): Promise<void> {
  const next = await showAppPrompt(t('files.context.renamePrompt'), {
    title: t('files.context.renameTitle'),
    defaultValue: row.name
  })
  if (!next?.trim() || next.trim() === row.name) return
  const res = await window.mailClient.files.renameCloudItem({
    accountId: row.accountId,
    itemId: row.itemId,
    driveId: row.driveId,
    newName: next.trim()
  })
  if (res.ok) {
    pushToast(t('files.context.renamed'))
    onRenamed?.()
  } else if (res.error) {
    pushToast(res.error, 'error')
  }
}

export async function filesContextDeleteCloud(
  row: CloudFileRow,
  onDeleted?: () => void
): Promise<void> {
  const ok = await showAppConfirm(t('files.context.deleteConfirm', { name: row.name }), {
    title: t('files.context.deleteTitle'),
    variant: 'danger',
    confirmLabel: t('common.delete')
  })
  if (!ok) return
  const res = await window.mailClient.files.deleteCloudItem({
    accountId: row.accountId,
    itemId: row.itemId,
    driveId: row.driveId
  })
  if (res.ok) {
    pushToast(t('files.context.deleted'))
    onDeleted?.()
  } else if (res.error) {
    pushToast(res.error, 'error')
  }
}

export async function filesContextShareCloudLink(
  row: CloudFileRow,
  scope: 'organization' | 'anonymous'
): Promise<void> {
  if (row.cloudProvider !== 'microsoft') {
    const url = row.webUrl?.trim()
    if (!url) {
      pushToast(t('files.cloud.noWebUrl'), 'error')
      return
    }
    await navigator.clipboard.writeText(url)
    pushToast(t('files.cloud.linkCopied'))
    return
  }
  try {
    const res = await window.mailClient.compose.createDriveSharingLink({
      accountId: row.accountId,
      itemId: row.itemId,
      driveId: row.driveId,
      type: 'view',
      scope
    })
    await navigator.clipboard.writeText(res.webUrl)
    pushToast(t('files.context.shareLinkCopied'))
  } catch (e) {
    pushToast(e instanceof Error ? e.message : String(e), 'error')
  }
}

export function filesContextOpenEntityLink(row: MailFileIndexRow): void {
  const anchor: ChronellEntityRef = { kind: 'mail', messageId: row.messageId }
  useFilesContextUiStore.getState().openEntityLink(anchor)
}

export function filesContextOpenCreateTask(
  title: string,
  accountId?: string,
  notes?: string
): void {
  useFilesContextUiStore.getState().openCreateTask({ title, notes, accountId })
}

export async function filesContextOpenCreateCalendarFromMail(
  row: MailFileIndexRow,
  accounts: ConnectedAccount[]
): Promise<void> {
  const data = await window.mailClient.files.readMailAttachmentBytes({ fileId: row.id })
  if (!data.ok || !data.dataBase64) {
    pushToast(data.error ?? t('files.context.attachFailed'), 'error')
    return
  }
  useFilesContextUiStore.getState().openCreateCalendar({
    subject: row.name.replace(/\.[^.]+$/, ''),
    accountId: defaultAccountId(accounts, row.accountId) ?? undefined,
    attachments: [
      {
        name: data.name ?? row.name,
        contentType: data.contentType ?? row.mime ?? 'application/octet-stream',
        size: row.size ?? Math.max(0, Math.floor((data.dataBase64.length * 3) / 4)),
        dataBase64: data.dataBase64
      }
    ]
  })
}

export function filesContextOpenCreateCalendarFromCloud(
  row: CloudFileRow,
  accounts: ConnectedAccount[]
): void {
  const url = row.webUrl?.trim()
  useFilesContextUiStore.getState().openCreateCalendar({
    subject: row.name.replace(/\.[^.]+$/, ''),
    accountId: defaultAccountId(accounts, row.accountId) ?? undefined,
    referenceAttachments: url ? [{ name: row.name, sourceUrl: url }] : undefined
  })
}

export function filesContextCanCreateTask(accountId: string, accounts: ConnectedAccount[]): boolean {
  return accountSupportsCloudTasks(accounts.find((a) => a.id === accountId))
}
