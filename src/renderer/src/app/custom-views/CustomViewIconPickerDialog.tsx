import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { CUSTOM_VIEW_DEFAULT_ICON_ID } from '@/lib/custom-view-tab-icon'

export function CustomViewIconPickerDialog({
  open,
  viewId,
  viewName,
  iconId,
  onIconChange,
  onClose,
  closeOnPick = true
}: {
  open: boolean
  viewId: string
  viewName: string
  iconId?: string
  onIconChange: (viewId: string, iconId: string) => void
  onClose: () => void
  /** Dialog nach Symbolwahl schließen (Tab-Update sichtbar machen). */
  closeOnPick?: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-background/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e): void => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-labelledby="custom-view-icon-picker-title"
        className="relative max-h-[min(90vh,640px)] w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 id="custom-view-icon-picker-title" className="min-w-0 truncate text-sm font-semibold text-foreground">
            {t('customView.iconPickerTitle', { name: viewName })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          <CalendarEventIconPicker
            layout="preview"
            defaultPickerOpen
            title={viewName}
            iconId={iconId ?? CUSTOM_VIEW_DEFAULT_ICON_ID}
            onIconChange={(next): void => {
              const icon = next?.trim() ? next.trim() : CUSTOM_VIEW_DEFAULT_ICON_ID
              onIconChange(viewId, icon)
              if (closeOnPick) onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
