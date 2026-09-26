import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  ComposeTextSnippetEditorDialog,
  type ComposeTextSnippetEditorState
} from '@/components/ComposeTextSnippetEditorDialog'
import {
  BUILTIN_COMPOSE_TEXT_SNIPPETS,
  loadCustomComposeTextSnippets,
  removeCustomComposeTextSnippet,
  saveCustomComposeTextSnippets,
  type ComposeTextSnippet
} from '@/lib/compose-text-snippets'
import { snippetHtmlToPlain } from '@/lib/compose-text-snippet-selection'
import { showAppConfirm } from '@/stores/app-dialog'

export default function SettingsTextSnippetsSection(): JSX.Element {
  const { t } = useTranslation()
  const [custom, setCustom] = useState<ComposeTextSnippet[]>(() => loadCustomComposeTextSnippets())
  const [editorOpen, setEditorOpen] = useState<ComposeTextSnippetEditorState | null>(null)

  const refresh = useCallback((): void => {
    setCustom(loadCustomComposeTextSnippets())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const builtins = useMemo(() => [...BUILTIN_COMPOSE_TEXT_SNIPPETS], [])

  const persist = (next: ComposeTextSnippet[]): void => {
    saveCustomComposeTextSnippets(next)
    setCustom(next)
  }

  const startCreate = (): void => {
    setEditorOpen({ mode: 'create', name: '', bodyHtml: '' })
  }

  const startEdit = (snippet: ComposeTextSnippet): void => {
    setEditorOpen({
      mode: 'edit',
      id: snippet.id,
      name: snippet.name,
      bodyHtml: snippet.html
    })
  }

  const removeSnippet = (snippet: ComposeTextSnippet): void => {
    void (async (): Promise<void> => {
      const ok = await showAppConfirm(
        t('settings.textSnippets.deleteConfirm', { name: snippet.name }),
        {
          title: t('settings.textSnippets.deleteTitle'),
          confirmLabel: t('common.delete'),
          variant: 'danger'
        }
      )
      if (!ok) return
      persist(removeCustomComposeTextSnippet(custom, snippet.id))
    })()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {t('settings.textSnippets.heading')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('settings.textSnippets.intro')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          onClick={startCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('settings.textSnippets.new')}
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.textSnippets.customHeading')}
        </h4>
        <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
          {custom.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t('settings.textSnippets.empty')}
            </li>
          ) : (
            custom.map((snippet) => (
              <li
                key={snippet.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{snippet.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {snippetHtmlToPlain(snippet.html) ||
                      (/<img\b/i.test(snippet.html)
                        ? t('settings.textSnippets.previewImageOnly')
                        : '—')}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={t('common.edit')}
                  onClick={(): void => startEdit(snippet)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  title={t('common.delete')}
                  onClick={(): void => void removeSnippet(snippet)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.textSnippets.builtinHeading')}
        </h4>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t('settings.textSnippets.builtinHint')}
        </p>
        <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
          {builtins.map((snippet) => (
            <li
              key={snippet.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-muted-foreground"
            >
              <FileText className="h-4 w-4 shrink-0 opacity-70" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground/90">{snippet.name}</div>
                <div className="truncate text-[11px]">
                  {snippetHtmlToPlain(snippet.html) || '—'}
                </div>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                {t('settings.textSnippets.builtinBadge')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {editorOpen ? (
        <ComposeTextSnippetEditorDialog
          state={editorOpen}
          onChange={setEditorOpen}
          onClose={(): void => setEditorOpen(null)}
          onSaved={refresh}
        />
      ) : null}
    </section>
  )
}
