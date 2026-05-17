import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingIndicatorProps {
  className?: string
  /** Icon size in Tailwind units (default h-5 w-5). */
  size?: string
  label?: string
}

/** Consistent inline loading spinner for panels and lists. */
export function LoadingIndicator({
  className,
  size = 'h-5 w-5',
  label
}: LoadingIndicatorProps): JSX.Element {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 text-muted-foreground', className)}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <Loader2 className={cn(size, 'animate-spin shrink-0')} aria-hidden />
      {label ? <span className="text-xs">{label}</span> : null}
    </div>
  )
}
