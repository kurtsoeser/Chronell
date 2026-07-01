import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listAllNotePageTemplates, type NotePageTemplateId } from '@/lib/note-page-templates'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass
} from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'

export function NotePageCreateMenu({
  onCreate,
  creating = false,
  disabled = false,
  buttonLabel,
  variant = 'icon'
}: {
  onCreate: (templateId: NotePageTemplateId) => void
  creating?: boolean
  disabled?: boolean
  buttonLabel?: string
  variant?: 'icon' | 'button'
}): JSX.Element {
  const { t } = useTranslation()
  const { customTemplates } = useCustomNotePageTemplates()
  const templates = listAllNotePageTemplates(customTemplates, t)
  const builtinTemplates = templates.filter((template) => template.builtin)
  const customResolved = templates.filter((template) => !template.builtin)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (templateId: NotePageTemplateId): void => {
    setOpen(false)
    onCreate(templateId)
  }

  const renderTemplateButton = (template: (typeof templates)[number]): JSX.Element => (
    <button
      key={template.id}
      type="button"
      role="menuitem"
      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-secondary/60"
      onClick={(): void => pick(template.id)}
    >
      <span className="text-xs font-medium text-foreground">{template.title}</span>
      {template.description ? (
        <span className="text-[11px] text-muted-foreground">{template.description}</span>
      ) : null}
    </button>
  )

  return (
    <div ref={rootRef} className="relative">
      {variant === 'icon' ? (
        <ModuleColumnHeaderIconButton
          type="button"
          onClick={(): void => setOpen((v) => !v)}
          disabled={disabled || creating}
          aria-label={t('notes.shell.newPage')}
          title={t('notes.shell.newPage')}
          aria-expanded={open}
        >
          {creating ? (
            <Loader2 className={cn(moduleColumnHeaderIconGlyphClass, 'animate-spin')} />
          ) : (
            <Plus className={moduleColumnHeaderIconGlyphClass} />
          )}
        </ModuleColumnHeaderIconButton>
      ) : (
        <button
          type="button"
          onClick={(): void => setOpen((v) => !v)}
          disabled={disabled || creating}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium'
          )}
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {buttonLabel ?? t('notes.shell.newPage')}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      )}

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-[min(420px,70vh)] min-w-[240px] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg',
            variant === 'icon' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('notes.templates.menuHeading')}
          </div>
          {builtinTemplates.map(renderTemplateButton)}
          {customResolved.length > 0 ? (
            <>
              <div className="mx-3 my-1 border-t border-border/60" />
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('notes.templates.customSection')}
              </div>
              {customResolved.map(renderTemplateButton)}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
