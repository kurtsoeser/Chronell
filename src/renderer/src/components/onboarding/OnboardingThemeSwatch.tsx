import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import {
  resolveSurfaceHex,
  type DarkPalette,
  type EffectiveTheme,
  type LightPalette,
  type ThemeMode
} from '@/stores/theme'

export function ThemeModeSwatch({
  mode,
  selected,
  label,
  onSelect
}: {
  mode: ThemeMode
  selected: boolean
  label: string
  onSelect: () => void
}): JSX.Element {
  const isSplit = mode === 'system'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
        selected
          ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/25'
          : 'border-border hover:border-primary/30'
      )}
    >
      <div
        className={cn(
          'relative h-16 w-16 overflow-hidden rounded-full border',
          listSubtleBorderClass
        )}
        aria-hidden
      >
        {isSplit ? (
          <>
            <div className="absolute inset-0 left-0 w-1/2 bg-[#f4f4f5]" />
            <div className="absolute inset-0 right-0 w-1/2 bg-[#1a1a1e]" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: mode === 'light' ? '#f4f4f5' : '#1a1a1e' }}
          />
        )}
        <div className="absolute inset-2 rounded-full border border-black/10 bg-card/30" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
      {selected ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : <span className="h-3.5" />}
    </button>
  )
}

export function PaletteVariantSwatch({
  schema,
  paletteId,
  selected,
  label,
  onSelect
}: {
  schema: EffectiveTheme
  paletteId: LightPalette | DarkPalette
  selected: boolean
  label: string
  onSelect: () => void
}): JSX.Element {
  const colors = resolveSurfaceHex(schema, {}, paletteId as DarkPalette, paletteId as LightPalette)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors',
        selected
          ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/25'
          : 'border-border hover:border-primary/30'
      )}
    >
      <div
        className={cn('flex h-14 w-14 overflow-hidden rounded-full border', listSubtleBorderClass)}
        aria-hidden
      >
        <div className="flex-1" style={{ backgroundColor: colors.sidebar }} />
        <div className="flex-1" style={{ backgroundColor: colors.card }} />
      </div>
      <span className="text-center text-2xs font-medium text-foreground">{label}</span>
    </button>
  )
}

export function AccentDot({
  name,
  hsl,
  selected,
  onSelect
}: {
  name: string
  hsl: string
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      onClick={onSelect}
      className={cn(
        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
        selected ? 'border-foreground scale-110' : 'border-transparent'
      )}
      style={{ backgroundColor: `hsl(${hsl})` }}
    />
  )
}

/** Kleine Layout-Skizze für den Onboarding-Schritt. */
export function MailLayoutIllustration({
  variant
}: {
  variant: 'dock' | 'float' | 'hidden'
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className="hidden shrink-0 lg:flex lg:w-[220px] lg:items-center lg:justify-center"
      aria-hidden
    >
      <div className="relative h-36 w-44 rotate-[-4deg]">
        <div className="absolute left-0 top-2 flex h-32 w-14 flex-col gap-1.5 rounded-lg border border-border bg-card p-2 shadow-md">
          <div className="h-2 w-6 rounded-full bg-muted" />
          <div className="h-1.5 w-full rounded bg-muted/70" />
          <div className="h-1.5 w-[80%] rounded bg-primary/40" />
          <div className="h-1.5 w-full rounded bg-muted/70" />
        </div>
        {variant !== 'hidden' ? (
          <div
            className={cn(
              'absolute rounded-lg border border-border bg-card p-2 shadow-lg',
              variant === 'dock' ? 'left-16 top-0 h-32 w-28' : 'left-20 top-10 h-24 w-24'
            )}
          >
            <div className="mb-2 h-2.5 w-10 rounded-full bg-muted" />
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded bg-muted/70" />
              <div className="h-1.5 w-[90%] rounded bg-muted/70" />
              <div className="h-1.5 w-[75%] rounded bg-muted/70" />
            </div>
          </div>
        ) : null}
        <span className="sr-only">{t(`firstRun.layoutIllustration.${variant}`)}</span>
      </div>
    </div>
  )
}
