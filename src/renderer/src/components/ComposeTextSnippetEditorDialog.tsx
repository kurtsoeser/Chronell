import { useTranslation } from 'react-i18next'
import {
  loadCustomComposeTextSnippets,
  saveCustomComposeTextSnippets,
  textToComposeSnippetHtml,
  upsertCustomComposeTextSnippet
} from '@/lib/compose-text-snippets'
import { showAppAlert } from '@/stores/app-dialog'

export interface ComposeTextSnippetEditorState {
  mode: 'create' | 'edit'
  id?: string
  name: string
  body: string
}

interface Props {
  state: ComposeTextSnippetEditorState
  onChange: (next: ComposeTextSnippetEditorState) => void
  onClose: () => void
  onSaved?: () => void
}

export function ComposeTextSnippetEditorDialog({
  state,
  onChange,
  onClose,
  onSaved
}: Props): JSX.Element {
  const { t } = useTranslation()

  const save = (): void => {
    const name = state.name.trim()
    const body = state.body.trim()
    if (!name) {
      void showAppAlert(t('settings.textSnippets.nameRequired'), {
        title: t('settings.textSnippets.heading')
      })
      return
    }
    if (!body) {
      void showAppAlert(t('settings.textSnippets.bodyRequired'), {
        title: t('settings.textSnippets.heading')
      })
      return
    }
    const custom = loadCustomComposeTextSnippets()
    const next = upsertCustomComposeTextSnippet(custom, {
      id: state.mode === 'edit' ? state.id : undefined,
      name,
      html: textToComposeSnippetHtml(body)
    })
    saveCustomComposeTextSnippets(next)
    onSaved?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snippet-editor-title"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xl">
        <h2 id="snippet-editor-title" className="text-sm font-semibold text-foreground">
          {state.mode === 'create'
            ? t('settings.textSnippets.editorNewTitle')
            : t('settings.textSnippets.editorEditTitle')}
        </h2>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('settings.textSnippets.nameLabel')}</span>
          <input
            type="text"
            value={state.name}
            onChange={(e): void => onChange({ ...state, name: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            autoFocus
          />
        </label>
        <label className="flex min-h-0 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('settings.textSnippets.bodyLabel')}</span>
          <textarea
            value={state.body}
            onChange={(e): void => onChange({ ...state, body: e.target.value })}
            rows={8}
            className="resize-y rounded border border-border bg-background px-2 py-1.5 text-sm leading-relaxed text-foreground"
          />
        </label>
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
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={save}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
