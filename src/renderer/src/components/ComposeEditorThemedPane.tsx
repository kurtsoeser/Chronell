import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useComposeEditorEffectiveTheme } from '@/stores/compose-editor-theme'

type Props = ComponentProps<'div'> & {
  children: ReactNode
}

/**
 * Nur Mail- und Signatur-Editor (TipTap): eigenes Hell/Dunkel-Schema.
 * Empfängerzeilen, Betreff und Signatur-Menü bleiben beim App-Chrome.
 */
export function ComposeEditorThemedPane({ children, className, ...rest }: Props): JSX.Element {
  const theme = useComposeEditorEffectiveTheme()

  return (
    <div
      className={cn('compose-editor-themed', className)}
      data-compose-theme={theme}
      {...rest}
    >
      {children}
    </div>
  )
}
