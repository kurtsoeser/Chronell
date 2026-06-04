import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  loadUseOsFloatingPanelsDefault,
  saveUseOsFloatingPanelsDefault
} from '@/lib/floating-panels-prefs'

export function SettingsFloatingPanelsSection(): JSX.Element {
  const { t } = useTranslation()
  const [useOsWindows, setUseOsWindows] = useState(() => loadUseOsFloatingPanelsDefault())

  const onToggle = useCallback((next: boolean): void => {
    setUseOsWindows(next)
    saveUseOsFloatingPanelsDefault(next)
  }, [])

  return (
    <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
      <h4 className="text-xs font-semibold text-foreground">{t('settings.floatingPanels.heading')}</h4>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.floatingPanels.hint')}</p>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={useOsWindows}
          onChange={(e): void => onToggle(e.target.checked)}
        />
        <span>{t('settings.floatingPanels.useOsWindows')}</span>
      </label>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        {t('settings.floatingPanels.shiftHint')}
      </p>
    </div>
  )
}
