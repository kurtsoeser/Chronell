import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { mergeInkColorPalette, normalizeInkHexColor } from '@shared/note-ink-colors'
import type { NoteInkTool } from '@shared/note-ink-document'
import {
  addNoteInkCustomColor,
  builtinInkColorsForTool,
  customInkColorsForTool,
  NOTE_INK_CUSTOM_COLORS_CHANGED_EVENT,
  readNoteInkCustomColorPrefs,
  removeNoteInkCustomColor
} from '@/lib/note-ink-color-prefs'
import { cn } from '@/lib/utils'

function isCustomInkColor(
  color: string,
  tool: 'pen' | 'highlighter',
  prefs = readNoteInkCustomColorPrefs()
): boolean {
  return customInkColorsForTool(prefs, tool).includes(color)
}

export function NoteInkColorPalette({
  tool,
  activeColor,
  disabled = false,
  onColorChange
}: {
  tool: NoteInkTool
  activeColor: string
  disabled?: boolean
  onColorChange: (color: string) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const [customPrefs, setCustomPrefs] = useState(() => readNoteInkCustomColorPrefs())
  const drawTool: 'pen' | 'highlighter' = tool === 'highlighter' ? 'highlighter' : 'pen'

  useEffect(() => {
    const refresh = (): void => setCustomPrefs(readNoteInkCustomColorPrefs())
    window.addEventListener(NOTE_INK_CUSTOM_COLORS_CHANGED_EVENT, refresh)
    return (): void => window.removeEventListener(NOTE_INK_CUSTOM_COLORS_CHANGED_EVENT, refresh)
  }, [])

  const builtin = builtinInkColorsForTool(drawTool)
  const custom = customInkColorsForTool(customPrefs, drawTool)
  const palette = useMemo(() => {
    if (tool === 'eraser') return []
    return mergeInkColorPalette(builtin, custom, activeColor)
  }, [activeColor, builtin, custom, tool])

  const handlePickCustom = useCallback(
    (raw: string): void => {
      const saved = addNoteInkCustomColor(drawTool, raw)
      if (!saved) return
      onColorChange(saved)
    },
    [drawTool, onColorChange]
  )

  const handleRemoveCustom = useCallback(
    (color: string): void => {
      removeNoteInkCustomColor(drawTool, color)
      if (activeColor === color) {
        onColorChange(builtin[0] ?? '#111827')
      }
    },
    [activeColor, builtin, drawTool, onColorChange]
  )

  if (tool === 'eraser') return null

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={t('notes.ink.colors')}
      >
        {palette.map((swatch) => {
          const customColor = isCustomInkColor(swatch, drawTool, customPrefs)
          return (
            <div key={swatch} className="group relative">
              <button
                type="button"
                title={swatch}
                aria-label={swatch}
                aria-pressed={activeColor === swatch}
                disabled={disabled}
                onClick={(): void => onColorChange(swatch)}
                className={cn(
                  'note-ink-color-swatch',
                  activeColor === swatch && 'note-ink-color-swatch--active',
                  customColor && 'note-ink-color-swatch--custom'
                )}
                style={{ backgroundColor: swatch }}
              />
              {customColor ? (
                <button
                  type="button"
                  title={t('notes.ink.removeCustomColor')}
                  aria-label={t('notes.ink.removeCustomColor')}
                  disabled={disabled}
                  onClick={(): void => handleRemoveCustom(swatch)}
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm group-hover:flex hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" aria-hidden />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <label
        className={cn(
          'note-ink-color-swatch note-ink-color-swatch--add inline-flex cursor-pointer items-center justify-center',
          disabled && 'pointer-events-none opacity-40'
        )}
        title={t('notes.ink.addCustomColor')}
      >
        <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t('notes.ink.addCustomColor')}</span>
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          value={normalizeInkHexColor(activeColor) ?? '#111827'}
          disabled={disabled}
          onChange={(e): void => handlePickCustom(e.target.value)}
        />
      </label>
    </div>
  )
}
