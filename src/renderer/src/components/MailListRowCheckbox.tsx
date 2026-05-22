import { cn } from '@/lib/utils'

interface Props {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  ariaLabel: string
  className?: string
}

export function MailListRowCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  className
}: Props): JSX.Element {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el): void => {
        if (el) el.indeterminate = indeterminate
      }}
      onChange={(e): void => {
        e.stopPropagation()
        onChange()
      }}
      onClick={(e): void => e.stopPropagation()}
      onPointerDown={(e): void => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        'h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-border accent-primary',
        className
      )}
    />
  )
}
