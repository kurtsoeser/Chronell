import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { CalendarDays, Clock, TextCursorInput } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** Toolbar-Dropdown: strukturiertes Datums- oder Uhrzeitfeld einfügen. */
export function NoteFormFieldInsertMenu({ editor }: { editor: Editor }): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  function insertDate(): void {
    editor.chain().focus().insertNoteDateField('').run()
    setOpen(false)
  }

  function insertTime(): void {
    editor.chain().focus().insertNoteTimeField('').run()
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        title={t('notes.formField.insertMenuTitle')}
        aria-label={t('notes.formField.insertMenuTitle')}
        aria-expanded={open}
        onClick={(): void => setOpen(!open)}
        className={cn(
          'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          open && 'bg-secondary/80 text-foreground'
        )}
      >
        <TextCursorInput className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label={t('common.close')}
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute left-0 top-7 z-40 min-w-[10rem] rounded-md border border-border bg-card py-1 shadow-xl">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/80"
              onClick={insertDate}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {t('notes.formField.insertDate')}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/80"
              onClick={insertTime}
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {t('notes.formField.insertTime')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
