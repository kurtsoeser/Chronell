import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ForwardedRef
} from 'react'
import { StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface NoteWikiLinkSuggestionItem {
  id: number
  title: string
}

export interface NoteWikiLinkSuggestionListProps {
  items: NoteWikiLinkSuggestionItem[]
  query: string
  command: (item: NoteWikiLinkSuggestionItem) => void
}

export interface NoteWikiLinkSuggestionListRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export const NoteWikiLinkSuggestionList = forwardRef(function NoteWikiLinkSuggestionList(
  { items, query, command }: NoteWikiLinkSuggestionListProps,
  ref: ForwardedRef<NoteWikiLinkSuggestionListRef>
): JSX.Element {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent): boolean => {
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex]
        if (item) command(item)
        return true
      }
      return false
    }
  }))

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
        {query.trim()
          ? t('notes.templates.wikiLinkNoResults')
          : t('notes.templates.wikiLinkBrowseHint')}
      </div>
    )
  }

  return (
    <div className="max-h-56 min-w-[220px] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/60'
          )}
          onMouseEnter={(): void => setSelectedIndex(index)}
          onMouseDown={(e): void => {
            e.preventDefault()
            command(item)
          }}
        >
          <StickyNote className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{item.title}</span>
        </button>
      ))}
    </div>
  )
})
