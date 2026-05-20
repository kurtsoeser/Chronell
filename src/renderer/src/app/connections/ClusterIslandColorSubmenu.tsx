import { useTranslation } from 'react-i18next'
import {
  DEFAULT_ISLAND_FILL_OPACITY,
  ENTITY_ICON_COLOR_PRESETS,
  type ClusterIslandStyle,
  islandStyleToFillRgba,
  islandStyleToStrokeRgba
} from '@/app/connections/cluster-island-style'
import { cn } from '@/lib/utils'

export function ClusterIslandColorSubmenu({
  style,
  onChange,
  onReset
}: {
  style: ClusterIslandStyle | null
  onChange: (style: ClusterIslandStyle) => void
  onReset: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const color = style?.color ?? ENTITY_ICON_COLOR_PRESETS[0]!
  const opacity = style?.opacity ?? DEFAULT_ISLAND_FILL_OPACITY
  const previewStyle = style ?? { color, opacity }

  return (
    <div className="w-[220px] p-2">
      <p className="mb-1.5 text-[10px] text-muted-foreground">
        {t('connections.graph.islandColorPresets')}
      </p>
      <div className="grid grid-cols-6 gap-1">
        {ENTITY_ICON_COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={cn(
              'h-6 w-6 rounded-md border border-black/15 shadow-sm',
              color.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-primary ring-offset-1'
            )}
            style={{ backgroundColor: hex }}
            title={hex}
            onClick={(): void => onChange({ color: hex, opacity })}
          />
        ))}
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          {t('connections.graph.islandColorOpacity')}
        </span>
        <input
          type="range"
          min={0.02}
          max={0.4}
          step={0.01}
          value={opacity}
          onChange={(e): void =>
            onChange({ color, opacity: Number(e.target.value) })
          }
          className="w-full"
        />
        <span className="text-[10px] text-foreground">{Math.round(opacity * 100)}%</span>
      </label>
      <div
        className="mt-2 h-8 rounded-lg border"
        style={{
          backgroundColor: islandStyleToFillRgba(previewStyle),
          borderColor: islandStyleToStrokeRgba(previewStyle)
        }}
        aria-hidden
      />
      <button
        type="button"
        className="mt-2 w-full text-left text-[10px] text-primary hover:underline"
        onClick={onReset}
      >
        {t('connections.graph.islandResetColor')}
      </button>
    </div>
  )
}
