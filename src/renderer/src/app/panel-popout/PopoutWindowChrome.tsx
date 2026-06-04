import { PopoutTitlebarControls } from '@/app/layout/PopoutTitlebarControls'
import { cn } from '@/lib/utils'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'

export function PopoutWindowChrome({
  title,
  onClose,
  onPopIn,
  leading,
  children,
  className
}: {
  title: string
  onClose: () => void
  onPopIn?: () => void
  leading?: React.ReactNode
  children: React.ReactNode
  className?: string
}): JSX.Element {
  const frameless = useFramelessTitlebar()

  return (
    <div
      className={cn(
        'flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground',
        className
      )}
    >
      <header
        className={cn(
          'glass-topbar flex shrink-0 items-center gap-2 border-b border-border px-2 text-xs',
          frameless
            ? 'electron-window-titlebar h-12 select-none pr-0'
            : 'h-10 bg-muted/40 px-3'
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-semibold text-foreground',
            frameless ? 'text-sm' : 'text-sm'
          )}
        >
          {title}
        </span>
        {leading}
        <PopoutTitlebarControls onPopIn={onPopIn} onClose={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
