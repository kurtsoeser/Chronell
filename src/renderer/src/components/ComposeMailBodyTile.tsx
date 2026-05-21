import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'div'> & {
  children: ReactNode
}

/**
 * Abgerundete Mail-Kachel (dunkler Chrome: An/Betreff, Toolbar, Signatur-Kopf).
 * Nur die TipTap-Textflächen wechseln per Theme-Toggle zwischen hell und dunkel.
 */
export function ComposeMailBodyTile({ children, className, ...rest }: Props): JSX.Element {
  return (
    <div className={cn('compose-mail-body-tile', className)} {...rest}>
      {children}
    </div>
  )
}
