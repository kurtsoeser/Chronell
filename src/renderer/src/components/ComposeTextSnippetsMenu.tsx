import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuDivider, MenuRow, MenuSectionTitle } from '@/components/list-view-menu-parts'
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
import {
  getEditorSelectionSnippetHtml,
  snippetHtmlToPlain
} from '@/lib/compose-text-snippet-selection'
import { showAppAlert, showAppConfirm } from '@/stores/app-dialog'

interface Props {
  editor: Editor
}

export function ComposeTextSnippetsMenu({ editor }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState<ComposeTextSnippet[]>(() => loadCustomComposeTextSnippets())
  const [editorOpen, setEditorOpen] = useState<ComposeTextSnippetEditorState | null>(null)

  const refreshCustom = useCallback((): void => {
    setCustom(loadCustomComposeTextSnippets())
  }, [])

  useEffect(() => {
    if (!open) return
    refreshCustom()
  }, [open, refreshCustom])

  const builtins = useMemo(() => [...BUILTIN_COMPOSE_TEXT_SNIPPETS], [])

  const insertSnippet = (html: string): void => {
    editor.chain().focus().insertContent(html).run()
    setOpen(false)
  }

  const close = (): void => setOpen(false)

  const persistCustom = (next: ComposeTextSnippet[]): void => {
    saveCustomComposeTextSnippets(next)
    setCustom(next)
  }

  const startCreate = (): void => {
    setEditorOpen({ mode: 'create', name: '', body: '' })
    setOpen(false)
  }

  const startEdit = (snippet: ComposeTextSnippet): void => {
    setEditorOpen({
      mode: 'edit',
      id: snippet.id,
      name: snippet.name,
      body: snippetHtmlToPlain(snippet.html)
    })
    setOpen(false)
  }

  const startFromSelection = (): void => {
    const selectedHtml = getEditorSelectionSnippetHtml(editor)
    if (!selectedHtml) {
      void showAppAlert('Bitte zuerst Text im Editor markieren.', { title: 'Textbaustein' })
      return
    }
    setEditorOpen({
      mode: 'create',
      name: '',
      body: snippetHtmlToPlain(selectedHtml)
    })
    setOpen(false)
  }

  const removeSnippet = (snippet: ComposeTextSnippet): void => {
    void (async (): Promise<void> => {
      const ok = await showAppConfirm(`Textbaustein „${snippet.name}" löschen?`, {
        title: 'Textbaustein löschen',
        confirmLabel: 'Löschen',
        variant: 'danger'
      })
      if (!ok) return
      persistCustom(removeCustomComposeTextSnippet(custom, snippet.id))
    })()
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          title="Textbausteine"
          aria-label="Textbausteine"
          aria-expanded={open}
          onClick={(): void => setOpen((v) => !v)}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            open && 'bg-secondary/80 text-foreground'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Schliessen"
              onClick={close}
            />
            <div className="absolute left-0 top-7 z-40 max-h-[min(420px,55vh)] w-[min(280px,92vw)] overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
              <MenuSectionTitle>Vorlagen</MenuSectionTitle>
              {builtins.map((s) => (
                <MenuRow key={s.id} onPick={(): void => insertSnippet(s.html)} title={s.name}>
                  {s.name}
                </MenuRow>
              ))}
              <MenuDivider />
              <MenuSectionTitle>Eigene</MenuSectionTitle>
              {custom.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  Noch keine eigenen Bausteine.
                </div>
              ) : (
                custom.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-0.5 rounded-md pr-1 hover:bg-secondary/40"
                  >
                    <button
                      type="button"
                      className="chronell-menu-row min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-foreground"
                      title={s.name}
                      onClick={(): void => insertSnippet(s.html)}
                    >
                      <span className="block truncate pl-6">{s.name}</span>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Bearbeiten"
                      aria-label="Bearbeiten"
                      onClick={(): void => startEdit(s)}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      title="Löschen"
                      aria-label="Löschen"
                      onClick={(): void => removeSnippet(s)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
              <MenuDivider />
              <MenuRow onPick={startCreate}>
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  Neuer Textbaustein…
                </span>
              </MenuRow>
              <MenuRow onPick={startFromSelection}>Auswahl als Baustein speichern…</MenuRow>
            </div>
          </>
        )}
      </div>

      {editorOpen ? (
        <ComposeTextSnippetEditorDialog
          state={editorOpen}
          onChange={setEditorOpen}
          onClose={(): void => setEditorOpen(null)}
          onSaved={refreshCustom}
        />
      ) : null}
    </>
  )
}
