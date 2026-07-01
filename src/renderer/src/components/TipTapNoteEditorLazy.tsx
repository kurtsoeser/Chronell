import { lazy, Suspense, type MutableRefObject, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

const TipTapNoteEditor = lazy(async () => {
  const m = await import('./TipTapNoteEditor')
  return { default: m.TipTapNoteEditor }
})

export interface TipTapNoteEditorLazyProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  placeholder: string
  fillHeight?: boolean
  minHeight?: number
  variant?: 'default' | 'compact'
  className?: string
  showThemeToggle?: boolean
  actionBarStart?: ReactNode
  stickyEditorChrome?: boolean
  flushRef?: MutableRefObject<(() => void) | null>
  insertHtmlRef?: MutableRefObject<((html: string) => void) | null>
  currentNoteId?: number
  onOpenLinkedNote?: (noteId: number) => void
}

export function TipTapNoteEditorLazy(props: TipTapNoteEditorLazyProps): JSX.Element {
  const fallbackHeight = props.fillHeight ? props.minHeight ?? 200 : props.minHeight ?? 280
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground"
          style={{ height: fallbackHeight }}
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      }
    >
      <TipTapNoteEditor {...props} />
    </Suspense>
  )
}
