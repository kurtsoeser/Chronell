import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardedRef
} from 'react'
import { CalendarDays, CheckSquare, Mail, StickyNote, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EntityLinkFilterTabs, type EntityLinkFilterTabValue } from '@/components/EntityLinkFilterTabs'
import { cn } from '@/lib/utils'

export type NoteEntityMentionSuggestionKind =
  | 'note'
  | 'mail'
  | 'cloud_task'
  | 'people_contact'
  | 'calendar_event'

export const NOTE_ENTITY_MENTION_FILTER_KINDS: readonly NoteEntityMentionSuggestionKind[] = [
  'note',
  'mail',
  'cloud_task',
  'people_contact',
  'calendar_event'
]

export interface NoteEntityMentionSuggestionItem {
  kind: NoteEntityMentionSuggestionKind
  title: string
  subtitle: string | null
  noteId?: number
  messageId?: number
  contactId?: number
  accountId?: string
  listId?: string
  taskId?: string
  graphEventId?: string
}

export interface NoteEntityMentionSuggestionListProps {
  items: NoteEntityMentionSuggestionItem[]
  query: string
  command: (item: NoteEntityMentionSuggestionItem) => void
}

export interface NoteEntityMentionSuggestionListRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

function kindIcon(kind: NoteEntityMentionSuggestionKind): typeof User {
  if (kind === 'calendar_event') return CalendarDays
  if (kind === 'note') return StickyNote
  if (kind === 'mail') return Mail
  if (kind === 'cloud_task') return CheckSquare
  return User
}

function itemKey(item: NoteEntityMentionSuggestionItem): string {
  if (item.kind === 'note') return `note-${item.noteId}`
  if (item.kind === 'mail') return `mail-${item.messageId}`
  if (item.kind === 'cloud_task') {
    return `task-${item.accountId}-${item.listId}-${item.taskId}`
  }
  if (item.kind === 'people_contact') return `contact-${item.contactId}`
  return `event-${item.accountId}-${item.graphEventId}`
}

export const NoteEntityMentionSuggestionList = forwardRef(function NoteEntityMentionSuggestionList(
  { items, query, command }: NoteEntityMentionSuggestionListProps,
  ref: ForwardedRef<NoteEntityMentionSuggestionListRef>
): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<EntityLinkFilterTabValue>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredItems = useMemo(
    () => (activeTab === 'all' ? items : items.filter((item) => item.kind === activeTab)),
    [activeTab, items]
  )

  useEffect(() => {
    setActiveTab('all')
  }, [query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems, activeTab])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent): boolean => {
      if (filteredItems.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + filteredItems.length - 1) % filteredItems.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % filteredItems.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = filteredItems[selectedIndex]
        if (item) command(item)
        return true
      }
      return false
    }
  }))

  const emptyMessage =
    query.trim() || activeTab !== 'all'
      ? activeTab === 'all'
        ? t('notes.entityMention.noResults')
        : t('notes.entityMention.noResultsInTab', {
            kind: t(`notes.links.kind.${activeTab}`)
          })
      : t('notes.entityMention.browseHint')

  return (
    <div className="min-w-[300px] max-w-[min(420px,92vw)] overflow-hidden rounded-md border border-border bg-popover shadow-md">
      <div className="border-b border-border/60 px-2 py-2">
        <EntityLinkFilterTabs
          value={activeTab}
          onChange={setActiveTab}
          kinds={NOTE_ENTITY_MENTION_FILTER_KINDS}
          preventMouseDownDefault
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-3 py-2.5 text-xs text-muted-foreground">{emptyMessage}</div>
      ) : (
        <div className="max-h-56 overflow-y-auto py-1">
          {filteredItems.map((item, index) => {
            const Icon = kindIcon(item.kind)
            return (
              <button
                key={itemKey(item)}
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs',
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/60'
                )}
                onMouseEnter={(): void => setSelectedIndex(index)}
                onMouseDown={(e): void => {
                  e.preventDefault()
                  command(item)
                }}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  {item.subtitle ? (
                    <span className="block truncate text-[10px] text-muted-foreground">{item.subtitle}</span>
                  ) : null}
                </span>
                {activeTab === 'all' ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {t(`notes.links.kind.${item.kind}`)}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
