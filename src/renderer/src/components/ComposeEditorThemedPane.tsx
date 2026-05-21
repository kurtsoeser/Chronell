import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'div'> & {
  children: ReactNode
}

/** Editor-Block in der Mail-Kachel (Toolbar + TipTap); Theme nur auf der Textfläche. */
export function ComposeEditorThemedPane({ children, className, ...rest }: Props): JSX.Element {
  return (
    <div className={cn('compose-mail-editor-section flex min-h-0 flex-col', className)} {...rest}>
      {children}
    </div>
  )
}
