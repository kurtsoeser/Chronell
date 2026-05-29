import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_COLOR_PRESET_OPTIONS, isPresetAccountColorClass } from '@shared/account-colors'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import { cn } from '@/lib/utils'

function openCustomColorPicker(currentHex: string, onPick: (hex: string) => void): void {
  const el = document.createElement('input')
  el.type = 'color'
  el.value = currentHex
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    opacity: '0',
    width: '1px',
    height: '1px',
    left: '0',
    top: '0',
    pointerEvents: 'none'
  })
  document.body.appendChild(el)
  el.addEventListener('change', () => {
    onPick(el.value)
    el.remove()
  })
  window.setTimeout(() => el.click(), 0)
}

interface Props {
  color: string
  disabled?: boolean
  saving?: boolean
  onColorChange: (next: string) => void
  className?: string
}

export function AccountColorPicker({
  color,
  disabled,
  saving,
  onColorChange,
  className
}: Props): JSX.Element {
  const { t } = useTranslation()
  const customHex = accountColorToCssBackground(color) ?? '#64748b'
  const isCustom = !isPresetAccountColorClass(color)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {ACCOUNT_COLOR_PRESET_OPTIONS.map((o) => {
          const hex = accountColorToCssBackground(o.value) ?? '#64748b'
          const active = color === o.value
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled || saving}
              title={o.label}
              aria-label={o.label}
              aria-pressed={active}
              onClick={(): void => onColorChange(o.value)}
              className={cn(
                'h-7 w-7 shrink-0 rounded-full border-2 transition-transform',
                active
                  ? 'scale-110 border-foreground ring-2 ring-ring/40'
                  : 'border-transparent hover:scale-105',
                disabled && 'cursor-not-allowed opacity-40'
              )}
              style={{ backgroundColor: hex }}
            />
          )
        })}
        <button
          type="button"
          disabled={disabled || saving}
          title={t('settings.accountColorCustom')}
          aria-label={t('settings.accountColorCustom')}
          aria-pressed={isCustom}
          onClick={(): void => openCustomColorPicker(customHex, onColorChange)}
          className={cn(
            'relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 transition-transform',
            isCustom
              ? 'scale-110 border-foreground ring-2 ring-ring/40'
              : 'border-dashed border-muted-foreground/50 hover:scale-105',
            disabled && 'cursor-not-allowed opacity-40'
          )}
          style={{
            background: `conic-gradient(from 0deg, ${customHex}, #f472b6, #fbbf24, ${customHex})`
          }}
        />
        {saving ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin self-center text-muted-foreground" />
        ) : null}
      </div>
      {isCustom ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t('settings.accountColorCustom')}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0 disabled:opacity-40"
            value={customHex}
            disabled={disabled || saving}
            onChange={(e): void => onColorChange(e.target.value)}
          />
          <span className="font-mono text-2xs text-muted-foreground">{customHex}</span>
        </div>
      ) : null}
    </div>
  )
}
