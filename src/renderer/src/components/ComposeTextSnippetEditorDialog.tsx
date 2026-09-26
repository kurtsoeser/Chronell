import { useTranslation } from 'react-i18next'
import { TipTapBody } from '@/components/TipTapBody'
import {
  loadCustomComposeTextSnippets,
  saveCustomComposeTextSnippets,
  upsertCustomComposeTextSnippet
} from '@/lib/compose-text-snippets'
import { isComposeSnippetHtmlEmpty } from '@/lib/compose-text-snippet-selection'
import { showAppAlert } from '@/stores/app-dialog'

export interface ComposeTextSnippetEditorState {
  mode: 'create' | 'edit'
  id?: string
  name: string
  /** HTML-Inhalt (Formatierung + Inline-Bilder). */
  bodyHtml: string
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
    if (!name) {
      void showAppAlert(t('settings.textSnippets.nameRequired'), {
        title: t('settings.textSnippets.heading')
      })
      return
    }
    if (isComposeSnippetHtmlEmpty(state.bodyHtml)) {
      void showAppAlert(t('settings.textSnippets.bodyRequired'), {
        title: t('settings.textSnippets.heading')
      })
      return
    }
    const custom = loadCustomComposeTextSnippets()
    const next = upsertCustomComposeTextSnippet(custom, {
      id: state.mode === 'edit' ? state.id : undefined,
      name,
      html: state.bodyHtml
    })
    saveCustomComposeTextSnippets(next)
    onSaved?.()
    onClose()
  }

  const editorKey = state.id ?? `new-${state.mode}`

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snippet-editor-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xl">
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
        <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('settings.textSnippets.bodyLabel')}</span>
          <p className="text-2xs text-muted-foreground">{t('settings.textSnippets.bodyHint')}</p>
          <div className="mt-1 max-h-[50vh] min-h-[220px] overflow-y-auto rounded-md border border-border bg-background">
            <TipTapBody
              key={editorKey}
              documentKey={editorKey}
              valueHtml={state.bodyHtml}
              onChangeHtml={(html): void => onChange({ ...state, bodyHtml: html })}
              placeholder={t('settings.textSnippets.bodyPlaceholder')}
              editorMinHeightClass="min-h-[180px]"
              fillHeight={false}
              variant="compact"
              className="!border-0"
            />
          </div>
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
