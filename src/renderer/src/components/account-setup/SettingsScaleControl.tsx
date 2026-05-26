import { cn } from '@/lib/utils'

export interface SettingsScaleControlProps {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  presets: readonly number[]
  formatPercent: (value: number) => number
  onChange: (value: number) => void
  onReset: () => void
  resetLabel: string
}

export function SettingsScaleControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  presets,
  formatPercent,
  onChange,
  onReset,
  resetLabel
}: SettingsScaleControlProps): JSX.Element {
  const percent = formatPercent(value)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-foreground">
          {label}
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e): void => {
          onChange(Number.parseFloat(e.target.value))
        }}
        className="h-2 w-full max-w-md cursor-pointer accent-primary"
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={(): void => onChange(preset)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors',
              Math.abs(value - preset) < step / 2
                ? 'border-primary bg-primary/10 font-medium text-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            )}
          >
            {formatPercent(preset)}%
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  )
}
