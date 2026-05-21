import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  useComposeEditorEffectiveTheme,
  useComposeEditorThemeStore
} from '@/stores/compose-editor-theme'

interface Props {
  className?: string
  /** Kompakter Icon-Button (Composer-Titelleiste). */
  compact?: boolean
}

export function ComposeEditorThemeToggle({ className, compact }: Props): JSX.Element {
  const { t } = useTranslation()
  const theme = useComposeEditorEffectiveTheme()
  const toggle = useComposeEditorThemeStore((s) => s.toggle)
  const Icon = theme === 'light' ? Sun : Moon
  const label =
    theme === 'light'
      ? t('mail.compose.editorThemeLight', { defaultValue: 'Editor: Hell' })
      : t('mail.compose.editorThemeDark', { defaultValue: 'Editor: Dunkel' })

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e): void => {
        e.stopPropagation()
        toggle()
      }}
      className={cn(
        compact
          ? 'rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground'
          : 'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground',
        className
      )}
    >
      <Icon className={compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
      {!compact ? (
        <span className="hidden sm:inline">
          {theme === 'light'
            ? t('mail.compose.editorThemeShortLight', { defaultValue: 'Hell' })
            : t('mail.compose.editorThemeShortDark', { defaultValue: 'Dunkel' })}
        </span>
      ) : null}
    </button>
  )
}
