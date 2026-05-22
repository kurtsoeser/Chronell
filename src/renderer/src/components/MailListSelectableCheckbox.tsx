import { cn } from '@/lib/utils'
import { MailListRowCheckbox } from '@/components/MailListRowCheckbox'

interface Props {
  checked: boolean
  /** Nach erster Auswahl: Checkboxen auf allen Zeilen sichtbar. */
  bulkSelectionMode: boolean
  hoverGroup: 'row' | 'subrow'
  onChange: () => void
  ariaLabel: string
  className?: string
}

/**
 * Outlook-Stil: Checkbox nur bei Hover, sobald mindestens eine Mail
 * ausgewählt ist auf allen Zeilen dauerhaft sichtbar.
 */
export function MailListSelectableCheckbox({
  checked,
  bulkSelectionMode,
  hoverGroup,
  onChange,
  ariaLabel,
  className
}: Props): JSX.Element {
  const hover =
    hoverGroup === 'row'
      ? 'group-hover/row:w-3.5 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'
      : 'group-hover/subrow:w-3.5 group-hover/subrow:opacity-100 group-hover/subrow:pointer-events-auto'

  const revealed = bulkSelectionMode || checked

  return (
    <div
      className={cn(
        'flex h-3.5 shrink-0 items-center justify-center overflow-hidden transition-[width,opacity] duration-150',
        revealed
          ? 'pointer-events-auto w-3.5 opacity-100'
          : cn('pointer-events-none w-0 opacity-0', hover),
        className
      )}
    >
      <MailListRowCheckbox checked={checked} ariaLabel={ariaLabel} onChange={onChange} />
    </div>
  )
}
