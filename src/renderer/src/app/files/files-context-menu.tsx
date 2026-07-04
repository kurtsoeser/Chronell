import type { TFunction } from 'i18next'
import {
  Calendar,
  Copy,
  ExternalLink,
  FolderOpen,
  Link2,
  ListTodo,
  Mail,
  Pencil,
  Save,
  Share2,
  StickyNote,
  Trash2,
  UploadCloud
} from 'lucide-react'
import type { CloudFileRow, MailFileIndexRow } from '@shared/files'
import type { ConnectedAccount } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import type { FilesContextTarget } from '@/stores/files-context-ui'
import {
  filesContextCanCreateTask,
  filesContextDeleteCloud,
  filesContextOpenCreateCalendarFromCloud,
  filesContextOpenCreateCalendarFromMail,
  filesContextOpenCreateTask,
  filesContextOpenEntityLink,
  filesContextOpenMail,
  filesContextRenameCloud,
  filesContextSaveMailAs,
  filesContextSendCloudAsAttachment,
  filesContextSendMailAsAttachment,
  filesContextShareCloudLink
} from '@/app/files/files-context-actions'

export interface FilesContextMenuHandlers {
  t: TFunction
  accounts: ConnectedAccount[]
  onOpenSourceMail?: (row: MailFileIndexRow) => void
  onSaveToCloud?: (row: MailFileIndexRow) => void
  onOpenCloudExternal?: (row: CloudFileRow) => void
  onSaveCloudAs?: (row: CloudFileRow) => void
  onCopyCloudLink?: (row: CloudFileRow) => void
  onOpenCloudFolder?: (row: CloudFileRow) => void
  onNoteAttach?: (target: FilesContextTarget) => void
  onCloudMutated?: () => void
}

export function buildFilesContextMenuItems(
  target: FilesContextTarget,
  h: FilesContextMenuHandlers
): ContextMenuItem[] {
  if (target.source === 'mail') {
    return buildMailFileContextMenu(target.row, h)
  }
  return buildCloudFileContextMenu(target.row, h)
}

function buildMailFileContextMenu(row: MailFileIndexRow, h: FilesContextMenuHandlers): ContextMenuItem[] {
  const { t, accounts } = h
  const msAccount = accounts.find((a) => a.id === row.accountId)?.provider === 'microsoft'
  const items: ContextMenuItem[] = [
    {
      id: 'files-open',
      label: t('files.context.open'),
      icon: FolderOpen,
      onSelect: (): void => {
        void filesContextOpenMail(row)
      }
    },
    {
      id: 'files-save-as',
      label: t('files.actions.saveAs'),
      icon: Save,
      onSelect: (): void => {
        void filesContextSaveMailAs(row)
      }
    }
  ]
  if (msAccount && h.onSaveToCloud) {
    items.push({
      id: 'files-save-cloud',
      label: t('files.actions.saveToCloud'),
      icon: UploadCloud,
      onSelect: (): void => h.onSaveToCloud?.(row)
    })
  }
  if (h.onOpenSourceMail) {
    items.push({
      id: 'files-open-mail',
      label: t('files.context.openSourceMail'),
      icon: Mail,
      onSelect: (): void => h.onOpenSourceMail?.(row)
    })
  }

  items.push({ id: 'files-sep-chronell', label: '', separator: true })
  items.push({
    id: 'files-chronell-label',
    label: t('files.context.chronellSection'),
    disabled: true
  })
  items.push({
    id: 'files-send-mail',
    label: t('files.context.sendAsAttachment'),
    icon: Mail,
    onSelect: (): void => {
      void filesContextSendMailAsAttachment(row, accounts)
    }
  })
  items.push({
    id: 'files-add-note',
    label: t('files.context.addToNote'),
    icon: StickyNote,
    onSelect: (): void => h.onNoteAttach?.({ source: 'mail', row })
  })
  items.push({
    id: 'files-create-event',
    label: t('files.context.createEvent'),
    icon: Calendar,
    onSelect: (): void => {
      void filesContextOpenCreateCalendarFromMail(row, accounts)
    }
  })
  if (filesContextCanCreateTask(row.accountId, accounts)) {
    items.push({
      id: 'files-create-task',
      label: t('files.context.createTask'),
      icon: ListTodo,
      onSelect: (): void => {
        filesContextOpenCreateTask(row.name, row.accountId, row.subject ?? undefined)
      }
    })
  }
  items.push({
    id: 'files-entity-link',
    label: t('files.context.addEntityLink'),
    icon: Link2,
    onSelect: (): void => filesContextOpenEntityLink(row)
  })

  return items
}

function buildCloudFileContextMenu(row: CloudFileRow, h: FilesContextMenuHandlers): ContextMenuItem[] {
  const { t, accounts } = h
  const isFolder = row.isFolder
  const items: ContextMenuItem[] = []

  if (isFolder) {
    items.push({
      id: 'files-open-folder',
      label: t('files.cloud.openFolder'),
      icon: FolderOpen,
      onSelect: (): void => h.onOpenCloudFolder?.(row)
    })
  } else {
    items.push({
      id: 'files-open',
      label: t('files.context.open'),
      icon: ExternalLink,
      disabled: !row.webUrl,
      onSelect: (): void => h.onOpenCloudExternal?.(row)
    })
    items.push({
      id: 'files-save-as',
      label: t('files.actions.saveAs'),
      icon: Save,
      onSelect: (): void => h.onSaveCloudAs?.(row)
    })
    items.push({
      id: 'files-copy-link',
      label: t('files.cloud.copyLink'),
      icon: Copy,
      disabled: !row.webUrl,
      onSelect: (): void => h.onCopyCloudLink?.(row)
    })
  }

  items.push({
    id: 'files-rename',
    label: t('files.context.rename'),
    icon: Pencil,
    onSelect: (): void => {
      void filesContextRenameCloud(row, h.onCloudMutated)
    }
  })

  if (!isFolder) {
    const shareItems: ContextMenuItem[] = []
    if (row.webUrl) {
      shareItems.push({
        id: 'files-share-existing',
        label: t('files.context.shareExistingLink'),
        icon: Link2,
        onSelect: (): void => {
          void h.onCopyCloudLink?.(row)
        }
      })
    }
    if (row.cloudProvider === 'microsoft') {
      shareItems.push({
        id: 'files-share-org',
        label: t('files.context.shareOrganization'),
        icon: Share2,
        onSelect: (): void => {
          void filesContextShareCloudLink(row, 'organization')
        }
      })
      shareItems.push({
        id: 'files-share-anon',
        label: t('files.context.shareAnyone'),
        icon: Share2,
        onSelect: (): void => {
          void filesContextShareCloudLink(row, 'anonymous')
        }
      })
    }
    if (shareItems.length > 0) {
      items.push({
        id: 'files-share',
        label: t('files.context.share'),
        icon: Share2,
        submenu: shareItems
      })
    }
  }

  items.push({
    id: 'files-delete',
    label: t('common.delete'),
    icon: Trash2,
    destructive: true,
    onSelect: (): void => {
      void filesContextDeleteCloud(row, h.onCloudMutated)
    }
  })

  items.push({ id: 'files-sep-chronell', label: '', separator: true })
  items.push({
    id: 'files-chronell-label',
    label: t('files.context.chronellSection'),
    disabled: true
  })

  if (!isFolder) {
    items.push({
      id: 'files-send-mail',
      label: t('files.context.sendAsAttachment'),
      icon: Mail,
      disabled: !row.webUrl && row.cloudProvider === 'google',
      onSelect: (): void => {
        void filesContextSendCloudAsAttachment(row, accounts)
      }
    })
    items.push({
      id: 'files-add-note',
      label: t('files.context.addToNote'),
      icon: StickyNote,
      onSelect: (): void => h.onNoteAttach?.({ source: 'cloud', row })
    })
    items.push({
      id: 'files-create-event',
      label: t('files.context.createEvent'),
      icon: Calendar,
      onSelect: (): void => filesContextOpenCreateCalendarFromCloud(row, accounts)
    })
    if (filesContextCanCreateTask(row.accountId, accounts)) {
      items.push({
        id: 'files-create-task',
        label: t('files.context.createTask'),
        icon: ListTodo,
        onSelect: (): void => {
          const notes = row.webUrl ? `${row.name}\n${row.webUrl}` : row.name
          filesContextOpenCreateTask(row.name, row.accountId, notes)
        }
      })
    }
  }

  return items
}
