import { useEffect, useId, useState } from 'react'
import { chronellDateFieldInputClass } from '@/components/ChronellDateField'
import { normalizeHm } from '@/lib/calendar-time-select'
import { cn } from '@/lib/utils'

export interface ChronellTimeFieldProps {
  value: string
  onChange: (hm: string) => void
  disabled?: boolean
  className?: string
  id?: string
  step?: number
  'aria-label'?: string
}

/**
 * Zeitfeld mit Tastatureingabe (`input[type=time]`, 1-Minuten-Schritte).
 */
export function ChronellTimeField({
  value,
  onChange,
  disabled,
  className,
  id: idProp,
  step = 60,
  'aria-label': ariaLabel
}: ChronellTimeFieldProps): JSX.Element {
  const autoId = useId()
  const id = idProp ?? autoId
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit(raw: string): void {
    const normalized = normalizeHm(raw)
    if (normalized) {
      onChange(normalized)
      setDraft(normalized)
      return
    }
    setDraft(value)
  }

  return (
    <input
      id={id}
      type="time"
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft}
      onChange={(e): void => setDraft(e.target.value)}
      onBlur={(): void => commit(draft)}
      onKeyDown={(e): void => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        commit(draft)
        e.currentTarget.blur()
      }}
      className={cn(chronellDateFieldInputClass, className)}
    />
  )
}
