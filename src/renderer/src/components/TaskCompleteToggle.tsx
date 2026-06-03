import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motionTaskCheckPop } from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

export interface TaskCompleteToggleProps {
  completed: boolean
  title: string
  compact?: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * Checkbox-Button für Aufgabenlisten mit sofortigem visuellem Feedback
 * (lokaler Zustand), bevor der Server/Store nachzieht.
 */
export function TaskCompleteToggle({
  completed,
  title,
  compact = false,
  onToggle
}: TaskCompleteToggleProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const prevCompleted = useRef(completed)
  const [flashPop, setFlashPop] = useState(false)
  const [localCompleted, setLocalCompleted] = useState<boolean | null>(null)

  const shownCompleted = localCompleted ?? completed

  useEffect(() => {
    if (completed !== prevCompleted.current) {
      setLocalCompleted(null)
    }
    prevCompleted.current = completed
  }, [completed])

  useEffect(() => {
    if (!flashPop) return
    const id = window.setTimeout(() => setFlashPop(false), 220)
    return (): void => window.clearTimeout(id)
  }, [flashPop])

  return (
    <button
      type="button"
      title={title}
      onClick={(e): void => {
        e.stopPropagation()
        const next = !shownCompleted
        setLocalCompleted(next)
        if (next && !reducedMotion) setFlashPop(true)
        onToggle(e)
      }}
      onMouseDown={(e): void => e.stopPropagation()}
      className={cn(
        'shrink-0 self-start pl-0.5 text-muted-foreground hover:text-foreground',
        compact ? 'py-1' : 'py-2'
      )}
    >
      {shownCompleted ? (
        <CheckCircle2
          className={cn(
            'h-4 w-4 text-primary',
            !reducedMotion && flashPop && motionTaskCheckPop
          )}
          aria-hidden
        />
      ) : (
        <Circle className="h-4 w-4" aria-hidden />
      )}
    </button>
  )
}
