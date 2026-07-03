import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { NoteSection } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'

export interface NotesSectionContextHandlers {
  t: TFunction
  section: NoteSection
  onRename: (section: NoteSection) => void
  onAddSubsection: (sectionId: number) => void
  onDelete: (section: NoteSection) => void
}

export function buildNotesSectionContextMenuItems(
  handlers: NotesSectionContextHandlers
): ContextMenuItem[] {
  const { t, section, onRename, onAddSubsection, onDelete } = handlers
  return [
    {
      id: 'rename',
      label: t('notes.sections.contextMenuRename'),
      icon: Pencil,
      onSelect: (): void => onRename(section)
    },
    {
      id: 'add-subsection',
      label: t('notes.sections.addSubsection'),
      icon: FolderPlus,
      onSelect: (): void => onAddSubsection(section.id)
    },
    { id: 'sep-delete', label: '', separator: true },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      onSelect: (): void => void onDelete(section)
    }
  ]
}
