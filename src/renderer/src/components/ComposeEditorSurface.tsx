import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'div'> & {
  children: ReactNode
}

/** Verfassen-Layout (An/Cc/Betreff-Chrome); Hell/Dunkel nur in den TipTap-Textflächen. */
export function ComposeEditorSurface({ children, className, ...rest }: Props): JSX.Element {
  return (
    <div className={cn('compose-editor-surface', className)} {...rest}>
      {children}
    </div>
  )
}
