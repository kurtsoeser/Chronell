import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { chronellPromptCardClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import {
  LayoutZoneTemplatePicker,
  type LayoutZoneTemplatePickerSelection
} from '@/app/layout-studio/LayoutZoneTemplatePicker'
import type { LayoutZoneTemplateId } from '@/app/layout-studio/layout-zone-templates'

type Props = {
  open: boolean
  onClose: () => void
  selected?: LayoutZoneTemplatePickerSelection
  onPick: (id: LayoutZoneTemplateId | 'custom') => void
}

export function LayoutZoneTemplatePickerDialog({
  open,
  onClose,
  selected = null,
  onPick
}: Props): JSX.Element | null {
  const { t } = useTranslation()

  const handlePick = (id: LayoutZoneTemplateId | 'custom'): void => {
    onPick(id)
    onClose()
  }

  return (
    <ModalRoot open={open} zIndex={320} onBackdropClick={onClose}>
      <ModalPanel
        className={cn(
          chronellPromptCardClass,
          'flex max-h-[min(720px,90vh)] w-[min(780px,96vw)] flex-col overflow-hidden shadow-2xl'
        )}
        aria-labelledby="layout-template-picker-title"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2
              id="layout-template-picker-title"
              className="text-sm font-semibold text-foreground"
            >
              {t('layoutStudio.chooseLayoutTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('layoutStudio.chooseLayoutHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('layoutStudio.chooseLayoutCloseAria')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <LayoutZoneTemplatePicker
            selected={selected}
            onSelect={handlePick}
            onConfirm={handlePick}
          />
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
