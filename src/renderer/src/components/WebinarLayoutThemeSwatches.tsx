import {
  WEBINAR_LAYOUT_COLOR_IDS,
  WEBINAR_LAYOUT_MODE_IDS,
  makeWebinarLayoutThemeId,
  webinarLayoutThemeAccents,
  type WebinarLayoutColorId,
  type WebinarLayoutModeId,
  type WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'
import { cn } from '@/lib/utils'

type Props = {
  value: WebinarLayoutThemeId
  onChange: (theme: WebinarLayoutThemeId) => void
  disabled?: boolean
  colorLabel: (color: WebinarLayoutColorId) => string
  modeLabel: (mode: WebinarLayoutModeId) => string
  className?: string
}

/**
 * Kompakte 2×6 Swatches (Dunkel/Hell × Akzent) statt großer Karten.
 */
export function WebinarLayoutThemeSwatches({
  value,
  onChange,
  disabled = false,
  colorLabel,
  modeLabel,
  className
}: Props): JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      {WEBINAR_LAYOUT_MODE_IDS.map((mode) => {
        const surface = mode === 'light' ? '#f5f2eb' : '#0f0f0f'
        return (
          <div key={mode} className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {modeLabel(mode)}
            </span>
            <div
              className="flex flex-wrap gap-1"
              role="radiogroup"
              aria-label={modeLabel(mode)}
            >
              {WEBINAR_LAYOUT_COLOR_IDS.map((color) => {
                const themeId = makeWebinarLayoutThemeId(color, mode)
                const selected = value === themeId
                const accent = webinarLayoutThemeAccents(color, mode).accent
                const label = colorLabel(color)
                return (
                  <button
                    key={themeId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${modeLabel(mode)} — ${label}`}
                    title={`${modeLabel(mode)} · ${label}`}
                    disabled={disabled}
                    onClick={(): void => onChange(themeId)}
                    className={cn(
                      'h-6 w-6 shrink-0 overflow-hidden rounded border transition-[box-shadow,border-color]',
                      selected
                        ? 'border-primary ring-2 ring-primary/70 ring-offset-1 ring-offset-background'
                        : 'border-border/80 hover:border-foreground/40',
                      disabled && 'opacity-50'
                    )}
                  >
                    <span className="flex h-full w-full" aria-hidden>
                      <span className="h-full w-[62%]" style={{ backgroundColor: surface }} />
                      <span className="h-full w-[38%]" style={{ backgroundColor: accent }} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
