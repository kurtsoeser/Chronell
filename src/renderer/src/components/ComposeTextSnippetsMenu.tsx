import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuDivider, MenuRow, MenuSectionTitle } from '@/components/list-view-menu-parts'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import {
  BUILTIN_COMPOSE_TEXT_SNIPPETS,
  loadCustomComposeTextSnippets,
  removeCustomComposeTextSnippet,
  saveCustomComposeTextSnippets,
  textToComposeSnippetHtml,
  upsertCustomComposeTextSnippet,
  type ComposeTextSnippet
} from '@/lib/compose-text-snippets'
import { showAppAlert, showAppConfirm, showAppPrompt } from '@/stores/app-dialog'

interface Props {
  editor: Editor
}

export function ComposeTextSnippetsMenu({ editor }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState<ComposeTextSnippet[]>(() => loadCustomComposeTextSnippets())
  const [editorOpen, setEditorOpen] = useState<{
    mode: 'create' | 'edit'
    id?: string
    name: string
    body: string
  } | null>(null)

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
    const body = snippet.html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim()
    setEditorOpen({ mode: 'edit', id: snippet.id, name: snippet.name, body })
    setOpen(false)
  }

  const saveEditor = (): void => {
    if (!editorOpen) return
    const name = editorOpen.name.trim()
    const body = editorOpen.body.trim()
    if (!name) {
      void showAppAlert('Bitte einen Namen eingeben.', { title: 'Textbaustein' })
      return
    }
    if (!body) {
      void showAppAlert('Bitte einen Text eingeben.', { title: 'Textbaustein' })
      return
    }
    const html = textToComposeSnippetHtml(body)
    const next = upsertCustomComposeTextSnippet(custom, {
      id: editorOpen.mode === 'edit' ? editorOpen.id : undefined,
      name,
      html
    })
    persistCustom(next)
    setEditorOpen(null)
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

  const saveSelectionAsSnippet = (): void => {
    void (async (): Promise<void> => {
      const { from, to } = editor.state.selection
      if (from === to) {
        void showAppAlert('Bitte zuerst Text im Editor markieren.', { title: 'Textbaustein' })
        return
      }
      const slice = editor.state.doc.slice(from, to)
      let selectedHtml = ''
      try {
        const { dom } = editor.view.serializeForClipboard(slice)
        const el = document.createElement('div')
        el.appendChild(dom.cloneNode(true))
        selectedHtml = sanitizeComposeHtmlFragment(el.innerHTML)
      } catch {
        selectedHtml = textToComposeSnippetHtml(editor.state.doc.textBetween(from, to, '\n'))
      }
      if (!selectedHtml.trim()) {
        void showAppAlert('Die Auswahl ist leer.', { title: 'Textbaustein' })
        return
      }
      const name = await showAppPrompt('Name des Textbausteins:', {
        title: 'Auswahl speichern',
        defaultValue: 'Mein Baustein',
        placeholder: 'z. B. Standard-Antwort'
      })
      if (name === null) return
      const trimmed = name.trim()
      if (!trimmed) return
      const next = upsertCustomComposeTextSnippet(custom, {
        name: trimmed,
        html: selectedHtml
      })
      persistCustom(next)
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
              <MenuRow onPick={(): void => void saveSelectionAsSnippet()}>
                Auswahl als Baustein speichern…
              </MenuRow>
            </div>
          </>
        )}
      </div>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snippet-editor-title"
        >
          <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xl">
            <h2 id="snippet-editor-title" className="text-sm font-semibold text-foreground">
              {editorOpen.mode === 'create' ? 'Textbaustein anlegen' : 'Textbaustein bearbeiten'}
            </h2>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Name</span>
              <input
                type="text"
                value={editorOpen.name}
                onChange={(e): void =>
                  setEditorOpen((s) => (s ? { ...s, name: e.target.value } : s))
                }
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                autoFocus
              />
            </label>
            <label className="flex min-h-0 flex-1 flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Text (Absätze mit Leerzeile)</span>
              <textarea
                value={editorOpen.body}
                onChange={(e): void =>
                  setEditorOpen((s) => (s ? { ...s, body: e.target.value } : s))
                }
                rows={8}
                className="resize-y rounded border border-border bg-background px-2 py-1.5 text-sm leading-relaxed text-foreground"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                onClick={(): void => setEditorOpen(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={saveEditor}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
