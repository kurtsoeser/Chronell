import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  getEditorSelectionSnippetHtml
} from '@/lib/compose-text-snippet-selection'
import { showAppAlert, showAppConfirm } from '@/stores/app-dialog'

interface Props {
  editor: Editor
}

export function ComposeTextSnippetsMenu({ editor }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState<ComposeTextSnippet[]>(() => loadCustomComposeTextSnippets())
  const [editorOpen, setEditorOpen] = useState<ComposeTextSnippetEditorState | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const refreshCustom = useCallback((): void => {
    setCustom(loadCustomComposeTextSnippets())
  }, [])

  useEffect(() => {
    if (!open) return
    refreshCustom()
  }, [open, refreshCustom])

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(280, vw - 16)
    let left = r.left
    if (left + width > vw - 8) left = vw - 8 - width
    if (left < 8) left = 8
    const spaceBelow = vh - r.bottom - 12
    const spaceAbove = r.top - 12
    const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove
    const maxH = Math.min(420, Math.max(160, preferBelow ? spaceBelow : spaceAbove))
    setPanelStyle({
      position: 'fixed',
      top: preferBelow ? r.bottom + 4 : undefined,
      bottom: preferBelow ? undefined : vh - r.top + 4,
      left,
      width,
      maxHeight: maxH,
      zIndex: 500
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return (): void => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const builtins = useMemo(() => [...BUILTIN_COMPOSE_TEXT_SNIPPETS], [])

  const insertSnippet = (html: string): void => {
    editor.chain().focus().insertContent(html).run()
    setOpen(false)
  }

  const persistCustom = (next: ComposeTextSnippet[]): void => {
    saveCustomComposeTextSnippets(next)
    setCustom(next)
  }

  const startCreate = (): void => {
    setEditorOpen({ mode: 'create', name: '', bodyHtml: '' })
    setOpen(false)
  }

  const startEdit = (snippet: ComposeTextSnippet): void => {
    setEditorOpen({
      mode: 'edit',
      id: snippet.id,
      name: snippet.name,
      bodyHtml: snippet.html
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
      bodyHtml: selectedHtml
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
          ref={btnRef}
          type="button"
          title="Textbausteine"
          aria-label="Textbausteine"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(): void => setOpen((v) => !v)}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            open && 'bg-secondary/80 text-foreground'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
        {open
          ? createPortal(
              <div
                ref={panelRef}
                role="menu"
                aria-label="Textbausteine"
                className="overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl"
                style={panelStyle}
              >
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
              </div>,
              document.body
            )
          : null}
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
