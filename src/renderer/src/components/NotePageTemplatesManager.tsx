import { useCallback, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NotePageTemplateEditDialog, type NotePageTemplateEditorState } from '@/components/NotePageTemplateEditDialog'
import {
  listAllNotePageTemplates,
  listBuiltinNotePageTemplateGroups,
  type ResolvedNotePageTemplate
} from '@/lib/note-page-templates'
import {
  loadCustomNotePageTemplates,
  removeCustomNotePageTemplate,
  upsertCustomNotePageTemplate,
  type CustomNotePageTemplate
} from '@/lib/note-page-templates-custom'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import { showAppAlert, showAppConfirm } from '@/stores/app-dialog'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export function NotePageTemplatesManager({ className }: Props): JSX.Element {
  const { t } = useTranslation()
  const { customTemplates, refreshCustomTemplates } = useCustomNotePageTemplates()
  const [editorOpen, setEditorOpen] = useState<NotePageTemplateEditorState | null>(null)

  const allTemplates = listAllNotePageTemplates(customTemplates, t)
  const builtinGroups = listBuiltinNotePageTemplateGroups(customTemplates, t)

  const startCreate = (): void => {
    setEditorOpen({ mode: 'create', name: '', description: '', bodyHtml: '' })
  }

  const startEdit = (template: CustomNotePageTemplate): void => {
    setEditorOpen({
      mode: 'edit',
      id: template.id,
      name: template.name,
      description: template.description,
      bodyHtml: template.bodyHtml
    })
  }

  const saveEditor = useCallback(
    (entry: { id?: string; name: string; description: string; bodyHtml: string }): void => {
      upsertCustomNotePageTemplate(loadCustomNotePageTemplates(), entry)
      refreshCustomTemplates()
      setEditorOpen(null)
    },
    [refreshCustomTemplates]
  )

  const removeTemplate = (template: CustomNotePageTemplate): void => {
    void (async (): Promise<void> => {
      const ok = await showAppConfirm(
        t('notes.templates.deleteConfirm', { name: template.name }),
        {
          title: t('notes.templates.deleteTitle'),
          confirmLabel: t('common.delete'),
          variant: 'danger'
        }
      )
      if (!ok) return
      removeCustomNotePageTemplate(loadCustomNotePageTemplates(), template.id)
      refreshCustomTemplates()
    })()
  }

  const renderRow = (template: ResolvedNotePageTemplate): JSX.Element => {
    const custom = customTemplates.find((c) => c.id === template.id)
    return (
      <div
        key={template.id}
        className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-2"
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">{template.title}</div>
          {template.description ? (
            <div className="text-[11px] text-muted-foreground">{template.description}</div>
          ) : null}
          {template.builtin ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {t('notes.templates.builtinBadge')}
            </div>
          ) : null}
        </div>
        {custom ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title={t('common.edit')}
              aria-label={t('common.edit')}
              onClick={(): void => startEdit(custom)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              title={t('common.delete')}
              aria-label={t('common.delete')}
              onClick={(): void => removeTemplate(custom)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{t('notes.templates.manageHeading')}</span>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
            {t('notes.templates.createButton')}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t('notes.templates.manageHint')}</p>
        <div className="space-y-1.5">
          {builtinGroups.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              {group.templates.map((template) => renderRow(template))}
            </div>
          ))}
          {customTemplates.length > 0 ? (
            <>
              <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('notes.templates.customSection')}
              </div>
              {customTemplates.map((custom) =>
                renderRow(allTemplates.find((row) => row.id === custom.id)!)
              )}
            </>
          ) : null}
        </div>
      </div>

      {editorOpen ? (
        <NotePageTemplateEditDialog
          editorState={editorOpen}
          onClose={(): void => setEditorOpen(null)}
          onSave={(entry): void => {
            if (!entry.name.trim()) {
              void showAppAlert(t('notes.templates.nameRequired'), {
                title: t('notes.templates.editorCreateTitle')
              })
              return
            }
            saveEditor(entry)
          }}
        />
      ) : null}
    </>
  )
}
