import { cn } from '@/lib/utils'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import { effectiveAccountAvatarKind } from '@/lib/account-avatar-display'
import { resolveAccountAvatarIcon } from '@/lib/account-avatar-icons'
import type { ConnectedAccount } from '@shared/types'

const SIZE_CLASS = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-8 w-8 text-2xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-base'
} as const

const ICON_CLASS = {
  xs: 'h-2.5 w-2.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8'
} as const

interface Props {
  account: ConnectedAccount
  imageSrc?: string | null
  size?: keyof typeof SIZE_CLASS
  inverted?: boolean
  className?: string
  title?: string
}

export function AccountAvatarBadge({
  account,
  imageSrc,
  size = 'sm',
  inverted = false,
  className,
  title
}: Props): JSX.Element {
  const dim = SIZE_CLASS[size]
  const iconDim = ICON_CLASS[size]
  const bg = accountColorToCssBackground(account.color)
  const kind = effectiveAccountAvatarKind(account)
  const showImage = Boolean(imageSrc) && (kind === 'provider' || kind === 'custom')

  if (showImage && imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        title={title}
        className={cn(
          'shrink-0 rounded-full object-cover',
          dim,
          inverted && 'ring-2 ring-primary-foreground/30',
          className
        )}
      />
    )
  }

  if (kind === 'icon' && account.avatarIconId) {
    const Icon = resolveAccountAvatarIcon(account.avatarIconId)
    if (Icon) {
      return (
        <div
          title={title}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full text-white',
            dim,
            !bg && account.color,
            inverted && 'ring-2 ring-primary-foreground/30',
            className
          )}
          style={bg ? { backgroundColor: bg } : undefined}
        >
          <Icon className={iconDim} aria-hidden />
        </div>
      )
    }
  }

  return (
    <div
      title={title}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        dim,
        !bg && account.color,
        inverted && 'ring-2 ring-primary-foreground/30',
        className
      )}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      {account.initials}
    </div>
  )
}
