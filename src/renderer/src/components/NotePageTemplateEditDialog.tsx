import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TipTapNoteEditorLazy } from '@/components/TipTapNoteEditorLazy'
import { prepareNoteBodyForEditor, storedBodyFromEditorHtml } from '@/lib/note-body-html'
import { cn } from '@/lib/utils'

export interface NotePageTemplateEditorState {
  mode: 'create' | 'edit'
  id?: string
  name: string
  description: string
  bodyHtml: string
}

interface Props {
  editorState: NotePageTemplateEditorState
  onClose: () => void
  onSave: (entry: { id?: string; name: string; description: string; bodyHtml: string }) => void
}

export function NotePageTemplateEditDialog({ editorState, onClose, onSave }: Props): JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(editorState.name)
  const [description, setDescription] = useState(editorState.description)
  const [bodyHtml, setBodyHtml] = useState(() => prepareNoteBodyForEditor(editorState.bodyHtml).html)

  useEffect(() => {
    setName(editorState.name)
    setDescription(editorState.description)
    setBodyHtml(prepareNoteBodyForEditor(editorState.bodyHtml).html)
  }, [editorState])

  const handleSave = (): void => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSave({
      id: editorState.mode === 'edit' ? editorState.id : undefined,
      name: trimmedName,
      description: description.trim(),
      bodyHtml: storedBodyFromEditorHtml(bodyHtml)
    })
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-template-editor-title"
    >
      <div className="flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xl">
        <h2 id="note-template-editor-title" className="text-sm font-semibold text-foreground">
          {editorState.mode === 'create'
            ? t('notes.templates.editorCreateTitle')
            : t('notes.templates.editorEditTitle')}
        </h2>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('notes.templates.editorNameLabel')}</span>
          <input
            type="text"
            value={name}
            onChange={(e): void => setName(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('notes.templates.editorDescriptionLabel')}</span>
          <input
            type="text"
            value={description}
            onChange={(e): void => setDescription(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>

        <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('notes.templates.editorBodyLabel')}</span>
          <TipTapNoteEditorLazy
            valueHtml={bodyHtml}
            onChangeHtml={setBodyHtml}
            placeholder={t('notes.editor.placeholder')}
            fillHeight
            minHeight={220}
            className="min-h-[220px] flex-1"
            showThemeToggle={false}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className={cn(
              'rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90',
              !name.trim() && 'opacity-50'
            )}
            onClick={handleSave}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
