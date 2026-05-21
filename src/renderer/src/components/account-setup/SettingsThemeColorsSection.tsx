import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DARK_PALETTE_SURFACES } from '@/lib/dark-palette-presets'
import { LIGHT_PALETTE_SURFACES } from '@/lib/light-palette-presets'
import { BUILTIN_THEME_COLOR_PRESETS } from '@/lib/theme-color-presets-builtin'
import { normalizeHex } from '@/lib/theme-color-utils'
import { cn } from '@/lib/utils'
import {
  SURFACE_TOKEN_LIST,
  isColorPresetActive,
  presetAppliesToSchema,
  resolveSurfaceHex,
  useThemeStore,
  type DarkPalette,
  type EffectiveTheme,
  type LightPalette,
  type ThemeColorPreset,
  type ThemeSurfaceToken
} from '@/stores/theme'

type ColorsTab = 'quick' | 'presets' | 'tune'

const LIGHT_VARIANTS: Array<{
  id: LightPalette
  labelKey: string
  descKey: string
}> = [
  { id: 'default', labelKey: 'settings.themeVariantLightFluent', descKey: 'settings.themeVariantLightFluentDesc' },
  { id: 'graphite', labelKey: 'settings.themeVariantLightWarm', descKey: 'settings.themeVariantLightWarmDesc' },
  { id: 'midnight', labelKey: 'settings.themeVariantLightCool', descKey: 'settings.themeVariantLightCoolDesc' },
  { id: 'nord', labelKey: 'settings.themeVariantLightNord', descKey: 'settings.themeVariantLightNordDesc' }
]

const DARK_VARIANTS: Array<{
  id: DarkPalette
  labelKey: string
  descKey: string
}> = [
  { id: 'graphite', labelKey: 'settings.themeVariantGraphite', descKey: 'settings.themeVariantGraphiteDesc' },
  { id: 'default', labelKey: 'topbar.paletteDefault', descKey: 'settings.themeVariantDefaultDesc' },
  { id: 'midnight', labelKey: 'settings.themeVariantMidnight', descKey: 'settings.themeVariantMidnightDesc' },
  { id: 'nord', labelKey: 'settings.themeVariantNord', descKey: 'settings.themeVariantNordDesc' }
]

const LAYER_LABEL_KEYS = [
  'settings.themeColorLayerL0',
  'settings.themeColorLayerL1',
  'settings.themeColorLayerL2',
  'settings.themeColorLayerL3'
] as const

function matchesSurfaceSet(
  a: Record<ThemeSurfaceToken, string>,
  b: Record<ThemeSurfaceToken, string>
): boolean {
  return SURFACE_TOKEN_LIST.every((t) => a[t].toLowerCase() === b[t].toLowerCase())
}

function surfaceSwatchColor(colors: Record<ThemeSurfaceToken, string>, token: ThemeSurfaceToken): string {
  return normalizeHex(colors[token] ?? '') ?? colors[token] ?? '#888888'
}

/** Vier L0–L3-Streifen (kompakt). */
function SurfaceLayerStrip({
  colors,
  size = 'md'
}: {
  colors: Record<ThemeSurfaceToken, string>
  size?: 'sm' | 'md'
}): JSX.Element {
  const height = size === 'md' ? 'h-2.5' : 'h-2'
  return (
    <div
      className={cn('flex shrink-0 overflow-hidden rounded-[2px] border border-border/35', height)}
      aria-hidden
    >
      {SURFACE_TOKEN_LIST.map((token) => (
        <div
          key={token}
          className="min-w-0 flex-1"
          style={{ backgroundColor: surfaceSwatchColor(colors, token) }}
        />
      ))}
    </div>
  )
}

/** Kontrast-Rand um Flaechen in der Mockup-Vorschau (unabhaengig vom Theme). */
function previewPaneOutline(schema: EffectiveTheme): string {
  return schema === 'dark' ? '0 0 0 1px rgba(255,255,255,0.22)' : '0 0 0 1px rgba(0,0,0,0.14)'
}

/**
 * L0–L3-Legende + App-Mockup (Topbar + Nav / Liste / Akzent).
 * L0 sichtbar als Zwischenraum (gap) zwischen den Spalten.
 */
function ModuleLayoutPreview({
  colors,
  schema,
  tall = false
}: {
  colors: Record<ThemeSurfaceToken, string>
  schema: EffectiveTheme
  tall?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const bg = surfaceSwatchColor(colors, 'background')
  const sidebar = surfaceSwatchColor(colors, 'sidebar')
  const card = surfaceSwatchColor(colors, 'card')
  const muted = surfaceSwatchColor(colors, 'muted')
  const outline = previewPaneOutline(schema)
  const listLine = schema === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid grid-cols-4 gap-2 border-b border-border/35 bg-muted/25 px-3 py-2">
        {SURFACE_TOKEN_LIST.map((token, index) => (
          <div key={token} className="min-w-0 text-center" title={colors[token]}>
            <div
              className="mx-auto h-5 w-full max-w-[4.5rem] rounded-sm border border-border/28"
              style={{
                backgroundColor: surfaceSwatchColor(colors, token),
                boxShadow: outline
              }}
            />
            <span className="mt-1 block text-[9px] font-semibold text-foreground">
              {t(LAYER_LABEL_KEYS[index])}
            </span>
            <span className="block truncate font-mono text-[8px] text-muted-foreground">
              {colors[token]}
            </span>
          </div>
        ))}
      </div>

      <div className="p-3">
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('settings.themeColorsLayoutPreview')}
        </p>
        <div
          className="overflow-hidden rounded-md"
          style={{ backgroundColor: bg, boxShadow: outline }}
        >
          <div
            className="flex h-6 items-center gap-1 border-b px-2"
            style={{
              backgroundColor: card,
              borderColor: schema === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              boxShadow: outline
            }}
            title={t('settings.themeColorCard')}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: muted }}
              aria-hidden
            />
            <span
              className="h-1.5 min-w-[28%] flex-1 rounded-sm"
              style={{ backgroundColor: listLine }}
              aria-hidden
            />
            <span
              className="h-1.5 w-[18%] shrink-0 rounded-sm"
              style={{ backgroundColor: listLine }}
              aria-hidden
            />
          </div>

          <div
            className={cn('flex gap-1.5 p-1.5', tall ? 'h-28' : 'h-[5.25rem]')}
            style={{ backgroundColor: bg }}
          >
            <div
              className="flex w-[22%] shrink-0 flex-col gap-1 rounded-sm p-1"
              style={{ backgroundColor: sidebar, boxShadow: outline }}
              title={t('settings.themeColorSidebar')}
            >
              <span className="h-1.5 w-[70%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
              <span className="h-1.5 w-[55%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
              <span className="h-1.5 w-[80%] rounded-sm bg-primary/35" aria-hidden />
              <span className="h-1.5 w-[50%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
            </div>
            <div
              className="flex min-w-0 flex-1 flex-col gap-1 rounded-sm p-1.5"
              style={{ backgroundColor: card, boxShadow: outline }}
              title={t('settings.themeColorCard')}
            >
              <span className="h-2 w-[45%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
              <span className="h-1.5 w-full rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
              <span className="h-1.5 w-[88%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
              <span className="h-1.5 w-[72%] rounded-sm" style={{ backgroundColor: listLine }} aria-hidden />
            </div>
            <div
              className="flex w-[18%] shrink-0 flex-col justify-end gap-1 rounded-sm p-1"
              style={{ backgroundColor: muted, boxShadow: outline }}
              title={t('settings.themeColorMuted')}
            >
              <span className="h-4 w-full rounded-sm opacity-80" style={{ backgroundColor: listLine }} aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniSurfacePreview({
  colors,
  schema = 'dark',
  compact = false
}: {
  colors: Record<ThemeSurfaceToken, string>
  schema?: EffectiveTheme
  compact?: boolean
}): JSX.Element {
  return <ModuleLayoutPreview colors={colors} schema={schema} tall={!compact} />
}

function SurfaceColorRow({
  id,
  label,
  layerTag,
  value,
  customized,
  onChange,
  onReset
}: {
  id: string
  label: string
  layerTag: string
  value: string
  customized: boolean
  onChange: (hex: string) => void
  onReset: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [hexDraft, setHexDraft] = useState(() => value.replace('#', ''))

  useEffect(() => {
    setHexDraft(value.replace('#', ''))
  }, [value])

  const commitHexDraft = (): void => {
    const normalized = normalizeHex(hexDraft)
    if (normalized) {
      onChange(normalized)
      setHexDraft(normalized.replace('#', ''))
      return
    }
    setHexDraft(value.replace('#', ''))
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-sm border border-border/30 bg-background/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:w-[10.5rem] sm:shrink-0">
        <span className="w-7 shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
          {layerTag}
        </span>
        <label htmlFor={id} className="min-w-0 truncate text-xs font-medium text-foreground">
          {label}
        </label>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            id={id}
            type="color"
            aria-label={label}
            className="h-9 w-11 shrink-0 cursor-pointer rounded-sm border border-border bg-background p-0.5"
            value={value}
            onChange={(e): void => onChange(e.target.value)}
          />
          <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-sm border border-border bg-background">
            <span className="select-none pl-2 font-mono text-[11px] text-muted-foreground">#</span>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label={t('settings.themeColorHexAria', { label })}
              maxLength={6}
              value={hexDraft}
              onChange={(e): void => {
                setHexDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))
              }}
              onBlur={commitHexDraft}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitHexDraft()
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === 'Escape') {
                  setHexDraft(value.replace('#', ''))
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              className="w-[4.75rem] border-0 bg-transparent py-0 pl-0.5 pr-2 font-mono text-[11px] uppercase tabular-nums text-foreground outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!customized}
          className={cn(
            'shrink-0 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            customized
              ? 'border-border bg-secondary/40 text-foreground hover:bg-secondary/70'
              : 'cursor-default border-border/28 bg-transparent text-muted-foreground/50'
          )}
        >
          {t('settings.themeColorReset')}
        </button>
      </div>
    </div>
  )
}

function ThemeColorTuneGroup({
  theme,
  title
}: {
  theme: EffectiveTheme
  title: string
}): JSX.Element {
  const { t } = useTranslation()
  const customColors = useThemeStore((s) => s.customColors)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const lightPalette = useThemeStore((s) => s.lightPalette)
  const setSurfaceColor = useThemeStore((s) => s.setSurfaceColor)
  const resetSurfaceColors = useThemeStore((s) => s.resetSurfaceColors)
  const resolved = resolveSurfaceHex(
    theme,
    customColors[theme],
    darkPalette,
    lightPalette
  )

  const tokenLabels: Record<ThemeSurfaceToken, string> = {
    background: t('settings.themeColorBackground'),
    sidebar: t('settings.themeColorSidebar'),
    card: t('settings.themeColorCard'),
    muted: t('settings.themeColorMuted')
  }
  const layerTags = ['L0', 'L1', 'L2', 'L3'] as const
  const overrides = customColors[theme]
  const hasCustom = SURFACE_TOKEN_LIST.some((token) => overrides[token] != null)

  return (
    <div className="space-y-3 rounded-sm border border-border/35 bg-card/20 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <button
          type="button"
          onClick={(): void => resetSurfaceColors(theme)}
          disabled={!hasCustom}
          className={cn(
            'rounded-sm border px-2.5 py-1 text-[11px] font-medium transition-colors',
            hasCustom
              ? 'border-border bg-secondary/40 text-foreground hover:bg-secondary/70'
              : 'cursor-default border-border/28 text-muted-foreground/50'
          )}
        >
          {t('settings.themeColorsResetMode')}
        </button>
      </div>
      <MiniSurfacePreview colors={resolved} schema={theme} compact />
      <div className="space-y-2">
        {SURFACE_TOKEN_LIST.map((token, index) => (
          <SurfaceColorRow
            key={token}
            id={`mailclient-theme-color-${theme}-${token}`}
            label={tokenLabels[token]}
            layerTag={layerTags[index]}
            value={resolved[token]}
            customized={overrides[token] != null}
            onChange={(hex): void => setSurfaceColor(theme, token, hex)}
            onReset={(): void => setSurfaceColor(theme, token, null)}
          />
        ))}
      </div>
    </div>
  )
}

function PresetCard({
  preset,
  active,
  onApply
}: {
  preset: ThemeColorPreset
  active: boolean
  onApply: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const target = presetAppliesToSchema(preset)
  const previewColors =
    target === 'light'
      ? preset.colors.light
      : target === 'dark'
        ? preset.colors.dark
        : preset.colors.dark
  const schemaLabel =
    target === 'light'
      ? t('settings.themeColorsLight')
      : target === 'dark'
        ? t('settings.themeColorsDark')
        : t('settings.themeColorPresetSchemaBoth')

  return (
    <button
      type="button"
      onClick={onApply}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-sm border text-left transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/35'
          : 'border-border/35 bg-card/30 hover:border-border hover:bg-secondary/30'
      )}
      title={t('settings.themeColorPresetApplyNamed', { name: preset.name })}
    >
      <div className="shrink-0 p-2">
        <span
          className={cn(
            'mb-1.5 inline-block rounded-sm px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
            target === 'light'
              ? 'bg-foreground/10 text-foreground'
              : target === 'dark'
                ? 'bg-foreground/15 text-foreground'
                : 'bg-muted/50 text-muted-foreground'
          )}
        >
          {schemaLabel}
        </span>
        <MiniSurfacePreview
          colors={previewColors}
          schema={target === 'light' ? 'light' : 'dark'}
          compact
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border/30 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {preset.name}
        </span>
        {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
      </div>
    </button>
  )
}

function PaletteVariantCard({
  colors,
  schema,
  label,
  description,
  active,
  onSelect
}: {
  colors: Record<ThemeSurfaceToken, string>
  schema: EffectiveTheme
  label: string
  description: string
  active: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col overflow-hidden rounded-md border text-left transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/35'
          : 'border-border/35 bg-card/30 hover:border-border hover:bg-secondary/30'
      )}
    >
      <div className="p-2">
        <ModuleLayoutPreview colors={colors} schema={schema} tall />
      </div>
      <div className="space-y-0.5 border-t border-border/30 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">{label}</span>
          {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

function ThemeColorsQuickTab(): JSX.Element {
  const { t } = useTranslation()
  const effective = useThemeStore((s) => s.effective)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const lightPalette = useThemeStore((s) => s.lightPalette)
  const customColors = useThemeStore((s) => s.customColors)
  const applyDarkPaletteVariant = useThemeStore((s) => s.applyDarkPaletteVariant)
  const applyLightPaletteVariant = useThemeStore((s) => s.applyLightPaletteVariant)

  const resolvedLight = useMemo(
    () => resolveSurfaceHex('light', customColors.light, darkPalette, lightPalette),
    [customColors.light, darkPalette, lightPalette]
  )
  const resolvedDark = useMemo(
    () => resolveSurfaceHex('dark', customColors.dark, darkPalette, lightPalette),
    [customColors.dark, darkPalette, lightPalette]
  )
  const resolvedActive = effective === 'dark' ? resolvedDark : resolvedLight

  const isDarkVariantActive = (id: DarkPalette): boolean =>
    darkPalette === id && matchesSurfaceSet(resolvedDark, DARK_PALETTE_SURFACES[id])

  const isLightVariantActive = (id: LightPalette): boolean =>
    lightPalette === id && matchesSurfaceSet(resolvedLight, LIGHT_PALETTE_SURFACES[id])

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-foreground">{t('settings.themeColorsLivePreview')}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {t('settings.themeColorsQuickHint')}
        </p>
        <div className="mt-2">
          <ModuleLayoutPreview colors={resolvedActive} schema={effective} tall />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground">{t('settings.themeColorsLightVariantsHeading')}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t('settings.themeColorsLightVariantsHint')}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LIGHT_VARIANTS.map((variant) => (
            <PaletteVariantCard
              key={variant.id}
              colors={LIGHT_PALETTE_SURFACES[variant.id]}
              schema="light"
              label={t(variant.labelKey)}
              description={t(variant.descKey)}
              active={isLightVariantActive(variant.id)}
              onSelect={(): void => applyLightPaletteVariant(variant.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground">{t('settings.themeColorsDarkVariantsHeading')}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t('settings.themeColorsDarkVariantsHint')}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DARK_VARIANTS.map((variant) => (
            <PaletteVariantCard
              key={variant.id}
              colors={DARK_PALETTE_SURFACES[variant.id]}
              schema="dark"
              label={t(variant.labelKey)}
              description={t(variant.descKey)}
              active={isDarkVariantActive(variant.id)}
              onSelect={(): void => applyDarkPaletteVariant(variant.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ThemeColorsPresetsTab(): JSX.Element {
  const { t } = useTranslation()
  const colorPresets = useThemeStore((s) => s.colorPresets)
  const customColors = useThemeStore((s) => s.customColors)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const lightPalette = useThemeStore((s) => s.lightPalette)
  const saveColorPreset = useThemeStore((s) => s.saveColorPreset)
  const applyColorPreset = useThemeStore((s) => s.applyColorPreset)
  const deleteColorPreset = useThemeStore((s) => s.deleteColorPreset)
  const [presetName, setPresetName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const resolvedLight = useMemo(
    () => resolveSurfaceHex('light', customColors.light, darkPalette, lightPalette),
    [customColors.light, darkPalette, lightPalette]
  )
  const resolvedDark = useMemo(
    () => resolveSurfaceHex('dark', customColors.dark, darkPalette, lightPalette),
    [customColors.dark, darkPalette, lightPalette]
  )

  const isPresetActive = (preset: ThemeColorPreset): boolean =>
    isColorPresetActive(preset, resolvedLight, resolvedDark)

  const handleSave = (): void => {
    const result = saveColorPreset(presetName)
    if (!result.ok) {
      setSaveError(
        result.reason === 'limit'
          ? t('settings.themeColorPresetLimit')
          : t('settings.themeColorPresetNameRequired')
      )
      return
    }
    setPresetName('')
    setSaveError(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('settings.themeColorPresetsHint')}</p>

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">
          {t('settings.themeColorPresetsBuiltinHeading', { count: BUILTIN_THEME_COLOR_PRESETS.length })}
        </p>
        <div className="grid max-h-[min(52vh,28rem)] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {BUILTIN_THEME_COLOR_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={isPresetActive(preset)}
              onApply={(): void => applyColorPreset(preset.id)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-border/30 bg-muted/10 p-3">
        <p className="text-xs font-semibold text-foreground">{t('settings.themeColorPresetsCustomHeading')}</p>
        {colorPresets.length > 0 ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {colorPresets.map((preset) => (
              <div key={preset.id} className="flex flex-col gap-1.5">
                <PresetCard
                  preset={preset}
                  active={isPresetActive(preset)}
                  onApply={(): void => applyColorPreset(preset.id)}
                />
                <button
                  type="button"
                  onClick={(): void => deleteColorPreset(preset.id)}
                  className="self-end rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  {t('settings.themeColorPresetDelete')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">{t('settings.themeColorPresetsEmpty')}</p>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/28 pt-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="mailclient-theme-preset-name" className="mb-1 block text-[11px] font-medium text-foreground">
              {t('settings.themeColorPresetNameLabel')}
            </label>
            <input
              id="mailclient-theme-preset-name"
              type="text"
              maxLength={48}
              value={presetName}
              onChange={(e): void => {
                setPresetName(e.target.value)
                setSaveError(null)
              }}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              placeholder={t('settings.themeColorPresetNamePlaceholder')}
              className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
            />
            {saveError && <p className="mt-1 text-[11px] text-destructive">{saveError}</p>}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="shrink-0 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60"
          >
            {t('settings.themeColorPresetSave')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ThemeColorsTuneTab(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('settings.themeColorsTuneHint')}</p>
      {/* Untereinander: in schmalen Dialog-Spalten verhindert das Ueberlappungen der Farbzeilen */}
      <div className="flex flex-col gap-4">
        <ThemeColorTuneGroup theme="light" title={t('settings.themeColorsLight')} />
        <ThemeColorTuneGroup theme="dark" title={t('settings.themeColorsDark')} />
      </div>
    </div>
  )
}

export function SettingsThemeColorsSection(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ColorsTab>('quick')

  const tabs: Array<{ id: ColorsTab; label: string }> = [
    { id: 'quick', label: t('settings.themeColorsTabQuick') },
    { id: 'presets', label: t('settings.themeColorsTabPresets') },
    { id: 'tune', label: t('settings.themeColorsTabTune') }
  ]

  return (
    <details className="group mt-4 rounded-sm border border-border bg-background/40" open>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground underline-offset-2 group-open:underline">
            {t('settings.themeColorsHeading')}
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
            {t('settings.themeColorsHint')}
          </span>
        </div>
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="border-t border-border px-3 py-3">
        <div
          className="mb-3 flex flex-wrap gap-1 rounded-sm border border-border/35 bg-muted/15 p-1"
          role="tablist"
          aria-label={t('settings.themeColorsHeading')}
        >
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={(): void => setTab(id)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-[11px] font-medium transition-colors',
                tab === id
                  ? 'bg-secondary/70 text-foreground ring-1 ring-border/70'
                  : 'text-muted-foreground hover:bg-secondary/25 hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'quick' && <ThemeColorsQuickTab />}
        {tab === 'presets' && <ThemeColorsPresetsTab />}
        {tab === 'tune' && <ThemeColorsTuneTab />}
      </div>
    </details>
  )
}
