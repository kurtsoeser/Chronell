import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { UserPlus, X } from 'lucide-react'
import type { ComposeRecipientSuggestion } from '@shared/types'
import { ComposeContactPickerDialog } from '@/components/ComposeContactPickerDialog'
import {
  formatRecipientsWithTail,
  normalizeRecipientSuggestionQuery,
  parseRecipientEntry,
  parseRecipientsBulk,
  parseRecipientsWithTail
} from '@/lib/compose-helpers'
import { cn } from '@/lib/utils'

export type RecipientTokenFieldHandle = {
  openContactPicker: () => void
}

export const RecipientTokenField = forwardRef<
  RecipientTokenFieldHandle,
  {
    label: string
    value: string
    onChange: (v: string) => void
    accountId: string
    showToggle?: boolean
    onToggleCcBcc?: () => void
    className?: string
    /** Innerhalb der dunkleren Compose-Flaeche (An/Betreff/Editor). */
    inEditorSurface?: boolean
    /** Innerhalb der weissen Mail-Kachel (dezente Trennlinien). */
    inMailTile?: boolean
    /** Label-Spalte ausblenden (z. B. in Calendar PropertyRow). */
    hideLabelColumn?: boolean
    placeholder?: string
  }
>(function RecipientTokenField(
  {
    label,
    value,
    onChange,
    accountId,
    showToggle,
    onToggleCcBcc,
    className,
    inEditorSurface,
    inMailTile,
    hideLabelColumn,
    placeholder
  },
  ref
) {
  const { complete, tail } = useMemo(() => parseRecipientsWithTail(value), [value])
  const [suggestions, setSuggestions] = useState<ComposeRecipientSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useImperativeHandle(ref, () => ({
    openContactPicker: (): void => setPickerOpen(true)
  }))

  const fetchSuggest = useCallback(
    async (q: string): Promise<void> => {
      const t = normalizeRecipientSuggestionQuery(q)
      setLoadingSuggest(true)
      try {
        const list = await window.mailClient.compose.recipientSuggestions({
          accountId,
          query: t
        })
        setSuggestions(list)
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggest(false)
      }
    },
    [accountId]
  )

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    const delay = tail.trim().length === 0 ? 0 : 220
    debRef.current = setTimeout(() => {
      void fetchSuggest(tail)
    }, delay)
    return (): void => {
      if (debRef.current) clearTimeout(debRef.current)
    }
  }, [tail, fetchSuggest])

  const commitTail = (opts?: { pickFirstSuggestion?: boolean }): void => {
    const trimmed = tail.trim()
    if (!trimmed) return

    const asRecipient = parseRecipientEntry(trimmed)
    if (asRecipient) {
      onChange(formatRecipientsWithTail([...complete, asRecipient], ''))
      setOpen(false)
      return
    }

    if (opts?.pickFirstSuggestion && suggestions.length > 0) {
      const s = suggestions[0]!
      const addr = s.email.trim()
      if (!addr) return
      onChange(
        formatRecipientsWithTail(
          [...complete, { address: addr, name: s.displayName?.trim() || undefined }],
          ''
        )
      )
      setOpen(false)
      return
    }

    const parts = trimmed.split(/[,;]+/)
    if (parts.length > 1) {
      const nextComplete = [...complete]
      let remaining = ''
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]?.trim() ?? ''
        if (!part) continue
        const one = parseRecipientEntry(part)
        if (one) {
          nextComplete.push(one)
        } else if (i === parts.length - 1) {
          remaining = part
        }
      }
      onChange(formatRecipientsWithTail(nextComplete, remaining))
      setOpen(false)
    }
  }

  const mergeRecipients = (added: { address: string; name?: string }[]): void => {
    if (added.length === 0) return
    const seen = new Set(complete.map((r) => r.address.toLowerCase()))
    const next = [...complete]
    for (const r of added) {
      const key = r.address.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      next.push(r)
    }
    onChange(formatRecipientsWithTail(next, tail))
  }

  const removeAt = (idx: number): void => {
    const next = complete.filter((_, i) => i !== idx)
    onChange(formatRecipientsWithTail(next, tail))
  }

  const pickSuggestion = (s: ComposeRecipientSuggestion): void => {
    const addr = s.email.trim()
    if (!addr) return
    const next = [...complete, { address: addr, name: s.displayName?.trim() || undefined }]
    onChange(formatRecipientsWithTail(next, ''))
    setOpen(false)
    inputRef.current?.focus()
  }

  const rowBorder = inMailTile
    ? ''
    : inEditorSurface
      ? 'border-[hsl(var(--compose-surface-border)/0.55)]'
      : 'border-border/60'
  const rowPad = inMailTile || inEditorSurface ? 'px-3' : 'px-4'

  return (
    <div
      className={cn(
        'relative flex items-start py-2',
        !inMailTile && 'border-b',
        rowBorder,
        rowPad,
        className
      )}
    >
      {!hideLabelColumn ? (
        <div className="mt-1.5 flex w-12 shrink-0 items-center gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            type="button"
            title="Aus Kontakten wählen"
            aria-label="Aus Kontakten wählen"
            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onMouseDown={(e): void => e.preventDefault()}
            onClick={(): void => setPickerOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className="relative min-w-0 flex-1">
        <div className="flex min-h-[28px] flex-wrap items-center gap-1 rounded border border-transparent bg-transparent px-0 py-0.5 focus-within:border-border/80">
          {complete.map((r, idx) => (
            <span
              key={`${r.address}-${idx}`}
              className={cn(
                'inline-flex max-w-full items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] text-foreground',
                inMailTile
                  ? 'border-[color:var(--compose-chrome-chip-border)] bg-[color:var(--compose-chrome-chip-bg)]'
                  : inEditorSurface
                    ? 'border-[hsl(var(--compose-surface-border)/0.65)] bg-[hsl(var(--compose-surface-muted))]'
                    : 'border-border/70 bg-secondary/50'
              )}
            >
              <span className="truncate">
                {r.name ? `${r.name} <${r.address}>` : r.address}
              </span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Empfaenger entfernen"
                onClick={(): void => removeAt(idx)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            aria-label={label || undefined}
            value={tail}
            onChange={(e): void => {
              onChange(formatRecipientsWithTail(complete, e.target.value))
              setOpen(true)
            }}
            onFocus={(): void => setOpen(true)}
            onBlur={(): void => {
              commitTail()
              window.setTimeout(() => setOpen(false), 180)
            }}
            onPaste={(e): void => {
              const raw = e.clipboardData?.getData('text/plain') ?? ''
              if (!raw.trim()) return
              const bulk = parseRecipientsBulk(raw)
              const isTableOrList = /[\n\r\t,;]/.test(raw) || bulk.length > 1
              if (!isTableOrList) {
                const one = parseRecipientEntry(raw.trim())
                if (one) {
                  e.preventDefault()
                  mergeRecipients([one])
                  setOpen(false)
                }
                return
              }
              if (bulk.length === 0) return
              e.preventDefault()
              mergeRecipients(bulk)
              setOpen(false)
            }}
            onKeyDown={(e): void => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitTail({ pickFirstSuggestion: true })
              } else if (e.key === ',' || e.key === ';') {
                e.preventDefault()
                commitTail()
              } else if (e.key === 'Backspace' && tail === '' && complete.length > 0) {
                removeAt(complete.length - 1)
              }
            }}
            placeholder={
              complete.length
                ? ''
                : (placeholder ??
                  (hideLabelColumn
                    ? 'Tippen für Vorschläge'
                    : 'Tippen für Vorschläge oder + für Kontakte'))
            }
            className="min-w-[120px] flex-1 bg-transparent py-0.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {open && (suggestions.length > 0 || loadingSuggest) && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
            {loadingSuggest && suggestions.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">Vorschläge werden geladen…</div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={`${s.email}-${s.source}-${i}`}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-[11px] hover:bg-secondary"
                onMouseDown={(ev): void => {
                  ev.preventDefault()
                  pickSuggestion(s)
                }}
              >
                <span className="font-medium text-foreground">{s.email}</span>
                {s.displayName && (
                  <span className="text-[10px] text-muted-foreground">{s.displayName}</span>
                )}
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
                  {s.source === 'people-local'
                    ? 'Kontakt'
                    : s.source === 'mail-history'
                      ? 'Verlauf'
                      : s.source === 'graph-people'
                        ? 'Microsoft'
                        : s.source === 'graph-directory'
                          ? 'Verzeichnis'
                          : s.source === 'graph-group'
                            ? 'Gruppe'
                            : 'Vorschlag'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showToggle && onToggleCcBcc && (
        <button
          type="button"
          onClick={onToggleCcBcc}
          className="ml-2 mt-1 shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Cc/Bcc
        </button>
      )}
      <ComposeContactPickerDialog
        open={pickerOpen}
        accountId={accountId}
        onClose={(): void => setPickerOpen(false)}
        onPick={(email, displayName): void => {
          pickSuggestion({
            email,
            displayName,
            source: 'people-local'
          })
        }}
      />
    </div>
  )
})
