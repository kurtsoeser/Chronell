import { LayoutGrid, Pencil, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  subtitle?: string
  name: string
  nameLabel?: string
  onNameChange: (name: string) => void
  editMode: boolean
  onToggleEditMode: () => void
  onChooseLayout: () => void
  onRevertLayout?: () => void
  revertLabel?: string
  showRevert?: boolean
}

export function LayoutZoneEditorToolbar({
  title,
  subtitle,
  name,
  nameLabel,
  onNameChange,
  editMode,
  onToggleEditMode,
  onChooseLayout,
  onRevertLayout,
  revertLabel,
  showRevert = true
}: Props): JSX.Element {
  const { t } = useTranslation()

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{nameLabel ?? t('layoutStudio.layoutName')}</span>
          <input
            type="text"
            value={name}
            onChange={(e): void => onNameChange(e.target.value)}
            className="max-w-[12rem] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            aria-label={t('layoutStudio.layoutNameAria')}
          />
        </label>
        <button
          type="button"
          onClick={onChooseLayout}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground"
          title={t('layoutStudio.chooseLayoutTitle')}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          {t('layoutStudio.chooseLayout')}
        </button>
        <button
          type="button"
          onClick={onToggleEditMode}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            editMode
              ? 'border-primary/50 bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
          )}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          {editMode ? t('layoutStudio.editModeOn') : t('layoutStudio.editModeOff')}
        </button>
        {showRevert && onRevertLayout ? (
          <button
            type="button"
            onClick={onRevertLayout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            title={revertLabel ?? t('customView.revertLayoutTitle')}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {revertLabel ?? t('customView.revertLayout')}
          </button>
        ) : null}
      </div>
      {editMode ? (
        <p className="text-[11px] text-muted-foreground">{t('layoutStudio.editHint')}</p>
      ) : null}
    </header>
  )
}
