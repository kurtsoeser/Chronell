import { PenLine, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMPOSE_FONT_FAMILIES } from '@/lib/compose-font-families'
import {
  COMPOSE_TEXT_COLOR_OPTIONS,
  composeSettingsFontSizeOptions,
  patchComposeSettingsPrefs,
  resetComposeSettingsPrefs,
  type ComposeSettingsPrefsV1
} from '@/lib/compose-settings-prefs'
import { useComposeSettingsPrefs } from '@/lib/use-compose-settings-prefs'
import {
  COMPOSE_EDITOR_SCALE_MAX,
  COMPOSE_EDITOR_SCALE_MIN,
  COMPOSE_EDITOR_SCALE_STEP,
  composeEditorScalePercent,
  useComposeEditorScaleStore
} from '@/stores/compose-editor-scale'
import {
  useComposeEditorThemeStore,
  type ComposeEditorTheme
} from '@/stores/compose-editor-theme'
import { SettingsScaleControl } from '@/components/account-setup/SettingsScaleControl'
import { cn } from '@/lib/utils'

const COMPOSE_EDITOR_SCALE_PRESETS = [0.75, 1, 1.25, 1.5] as const

function SettingsField({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {hint ? <span className="block text-2xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  )
}

export function SettingsMailComposeSection(): JSX.Element {
  const { t } = useTranslation()
  const prefs = useComposeSettingsPrefs()
  const composeScale = useComposeEditorScaleStore((s) => s.scale)
  const setComposeScale = useComposeEditorScaleStore((s) => s.setScale)
  const resetComposeScale = useComposeEditorScaleStore((s) => s.resetScale)
  const editorThemePref = useComposeEditorThemeStore((s) => s.preference)
  const setEditorThemePref = useComposeEditorThemeStore((s) => s.setPreference)
  const [, bump] = useState(0)
  const refresh = useCallback((): void => bump((n) => n + 1), [])

  const apply = useCallback(
    (patch: Partial<ComposeSettingsPrefsV1>): void => {
      patchComposeSettingsPrefs(patch)
      refresh()
    },
    [refresh]
  )

  const selectClass =
    'w-full max-w-md rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring'

  const editorThemeValue = editorThemePref ?? 'app'

  return (
    <section className="space-y-4 rounded-md bg-background/60 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <PenLine className="h-3.5 w-3.5" aria-hidden />
        {t('settings.mailCompose.heading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.mailCompose.intro')}</p>

      <div className="grid max-w-md gap-4">
        <SettingsField
          label={t('settings.mailCompose.defaultFontSizeLabel')}
          hint={t('settings.mailCompose.defaultFontSizeHint')}
        >
          <select
            value={prefs.defaultFontSizePt}
            onChange={(e): void => apply({ defaultFontSizePt: Number.parseInt(e.target.value, 10) })}
            className={selectClass}
          >
            {composeSettingsFontSizeOptions().map((pt) => (
              <option key={pt} value={pt}>
                {pt} pt
              </option>
            ))}
          </select>
        </SettingsField>

        <SettingsField
          label={t('settings.mailCompose.defaultFontFamilyLabel')}
          hint={t('settings.mailCompose.defaultFontFamilyHint')}
        >
          <select
            value={prefs.defaultFontFamilyId}
            onChange={(e): void => apply({ defaultFontFamilyId: e.target.value })}
            className={selectClass}
            style={{ fontFamily: COMPOSE_FONT_FAMILIES.find((f) => f.id === prefs.defaultFontFamilyId)?.value }}
          >
            {COMPOSE_FONT_FAMILIES.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.value }}>
                {font.label}
              </option>
            ))}
          </select>
        </SettingsField>

        <SettingsField
          label={t('settings.mailCompose.defaultTextColorLabel')}
          hint={t('settings.mailCompose.defaultTextColorHint')}
        >
          <div className="flex flex-wrap gap-2">
            {COMPOSE_TEXT_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={t(opt.labelKey)}
                aria-label={t(opt.labelKey)}
                onClick={(): void => apply({ defaultTextColor: opt.value })}
                className={cn(
                  'h-7 w-7 rounded-md border-2 transition-transform hover:scale-105',
                  prefs.defaultTextColor === opt.value
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border'
                )}
                style={{ backgroundColor: opt.value }}
              />
            ))}
          </div>
        </SettingsField>

        <SettingsField
          label={t('settings.mailCompose.defaultEditorThemeLabel')}
          hint={t('settings.mailCompose.defaultEditorThemeHint')}
        >
          <select
            value={editorThemeValue}
            onChange={(e): void => {
              const v = e.target.value
              setEditorThemePref(v === 'app' ? null : (v as ComposeEditorTheme))
            }}
            className={selectClass}
          >
            <option value="app">{t('settings.mailCompose.editorThemeApp')}</option>
            <option value="light">{t('settings.mailCompose.editorThemeLight')}</option>
            <option value="dark">{t('settings.mailCompose.editorThemeDark')}</option>
          </select>
        </SettingsField>

        <div className="space-y-2">
          <SettingsScaleControl
            id="mailclient-compose-editor-scale"
            label={t('settings.mailCompose.editorScaleLabel')}
            hint={t('settings.mailCompose.editorScaleHint')}
            value={composeScale}
            min={COMPOSE_EDITOR_SCALE_MIN}
            max={COMPOSE_EDITOR_SCALE_MAX}
            step={COMPOSE_EDITOR_SCALE_STEP}
            presets={COMPOSE_EDITOR_SCALE_PRESETS}
            formatPercent={composeEditorScalePercent}
            onChange={setComposeScale}
            onReset={resetComposeScale}
            resetLabel={t('settings.scaleReset')}
          />
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t('settings.mailCompose.editorScaleShortcuts')}
          </p>
        </div>

        <SettingsField
          label={t('settings.mailCompose.defaultImportanceLabel')}
          hint={t('settings.mailCompose.defaultImportanceHint')}
        >
          <select
            value={prefs.defaultImportance}
            onChange={(e): void =>
              apply({ defaultImportance: e.target.value as ComposeSettingsPrefsV1['defaultImportance'] })
            }
            className={selectClass}
          >
            <option value="normal">{t('mail.compose.confidentialityNormal')}</option>
            <option value="high">{t('mail.compose.confidentialityHigh')}</option>
            <option value="low">{t('mail.compose.confidentialityLow')}</option>
          </select>
        </SettingsField>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/80 p-3">
          <input
            type="checkbox"
            checked={prefs.requestReadReceiptByDefault}
            onChange={(e): void => apply({ requestReadReceiptByDefault: e.target.checked })}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="flex-1 text-xs">
            <span className="block font-medium text-foreground">
              {t('settings.mailCompose.readReceiptDefaultTitle')}
            </span>
            <span className="mt-0.5 block leading-relaxed text-muted-foreground">
              {t('settings.mailCompose.readReceiptDefaultHint')}
            </span>
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={(): void => {
          resetComposeSettingsPrefs()
          resetComposeScale()
          setEditorThemePref(null)
          refresh()
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t('settings.mailCompose.resetDefaults')}
      </button>
    </section>
  )
}
