import { APP_BRANDING } from '@shared/app-branding'
import { APP_PRODUCT_NAME } from '@shared/app-version'
import { cn } from '@/lib/utils'

export interface AppBrandMarkProps {
  className?: string
  iconClassName?: string
  nameClassName?: string
  showName?: boolean
}

/** App-Icon (optional mit Produktname). Quelle: `resources/branding/Chromell-icon.svg`. */
export function AppBrandMark({
  className,
  iconClassName,
  nameClassName,
  showName = true
}: AppBrandMarkProps): JSX.Element {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <img
        src={APP_BRANDING.iconSvgPublicPath}
        alt=""
        className={cn('h-7 w-7 shrink-0 object-contain', iconClassName)}
        width={28}
        height={28}
        draggable={false}
      />
      {showName ? (
        <span className={cn('truncate text-sm font-semibold tracking-tight text-foreground', nameClassName)}>
          {APP_PRODUCT_NAME}
        </span>
      ) : null}
    </span>
  )
}
