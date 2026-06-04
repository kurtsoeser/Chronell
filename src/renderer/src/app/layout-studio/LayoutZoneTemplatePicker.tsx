import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { LayoutZoneThumbnail } from '@/app/layout-studio/LayoutZoneThumbnail'
import {
  buildZoneTemplate,
  LAYOUT_ZONE_TEMPLATE_IDS,
  type LayoutZoneTemplateId
} from '@/app/layout-studio/layout-zone-templates'

export type LayoutZoneTemplatePickerSelection = LayoutZoneTemplateId | 'custom' | null

type Props = {
  selected: LayoutZoneTemplatePickerSelection
  onSelect: (id: LayoutZoneTemplateId | 'custom') => void
  /** Doppelklick auf Vorlage (z. B. Assistent: direkt weiter). */
  onConfirm?: (id: LayoutZoneTemplateId | 'custom') => void
  showNewLayout?: boolean
  className?: string
}

export function LayoutZoneTemplatePicker({
  selected,
  onSelect,
  onConfirm,
  showNewLayout = true,
  className
}: Props): JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        className
      )}
    >
      {LAYOUT_ZONE_TEMPLATE_IDS.map((id) => {
        const active = selected === id
        const label = t(`layoutStudio.zoneTemplates.${id}`)
        return (
          <button
            key={id}
            type="button"
            onClick={(): void => onSelect(id)}
            onDoubleClick={onConfirm ? (): void => onConfirm(id) : undefined}
            className={cn(
              'flex min-w-0 flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors',
              active
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card/60 hover:border-primary/40 hover:bg-card'
            )}
            title={label}
          >
            <LayoutZoneThumbnail root={buildZoneTemplate(id)} size="lg" />
            <span className="line-clamp-2 text-center text-[9px] leading-snug text-muted-foreground">
              {label}
            </span>
          </button>
        )
      })}
      {showNewLayout ? (
        <button
          type="button"
          onClick={(): void => onSelect('custom')}
          onDoubleClick={onConfirm ? (): void => onConfirm('custom') : undefined}
          className={cn(
            'flex min-h-[6.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-2 transition-colors',
            selected === 'custom'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
          title={t('layoutStudio.newLayout')}
        >
          <div className="flex h-20 w-full items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/20">
            <Plus className="h-7 w-7 shrink-0 opacity-70" aria-hidden />
          </div>
          <span className="line-clamp-2 text-center text-[9px] leading-snug">
            {t('layoutStudio.newLayout')}
          </span>
        </button>
      ) : null}
    </div>
  )
}
