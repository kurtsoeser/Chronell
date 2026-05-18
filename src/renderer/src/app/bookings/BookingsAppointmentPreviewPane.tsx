import { useMemo } from 'react'
import { PanelRightClose, SquareArrowOutUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  BookingsAppointmentRow,
  BookingsBusinessRow,
  BookingsServiceRow,
  BookingsStaffMemberRow
} from '@shared/types'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { BookingsAppointmentPreview } from '@/app/bookings/BookingsAppointmentPreview'
import type { BookingsPreviewPlacement } from '@/app/bookings/bookings-shell-storage'
import { BOOKINGS_FLOAT_PREVIEW_SIZE_KEY } from '@/app/bookings/bookings-shell-storage'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import { cn } from '@/lib/utils'

export function BookingsAppointmentPreviewPane({
  open,
  placement,
  onPlacementChange,
  onClose,
  appointment,
  business,
  services,
  staffMembers,
  dockWidthPx,
  onDockWidthDrag
}: {
  open: boolean
  placement: BookingsPreviewPlacement
  onPlacementChange: (placement: BookingsPreviewPlacement) => void
  onClose: () => void
  appointment: BookingsAppointmentRow | null
  business: BookingsBusinessRow | null
  services: BookingsServiceRow[]
  staffMembers: BookingsStaffMemberRow[]
  dockWidthPx: number
  onDockWidthDrag: (delta: number) => void
}): JSX.Element | null {
  const { t } = useTranslation()

  const chrome = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-2 py-2">
        <div className={moduleColumnHeaderDockBarRowClass}>
          <span className={cn(moduleColumnHeaderUppercaseLabelClass, 'min-w-0 shrink-0 text-left')}>
            {t('bookings.preview.heading')}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {placement === 'dock' ? (
              <ModuleColumnHeaderIconButton
                title={t('bookings.preview.undockTitle')}
                onClick={(): void => onPlacementChange('float')}
              >
                <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            ) : null}
            <ModuleColumnHeaderIconButton title={t('bookings.preview.hideTitle')} onClick={onClose}>
              <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {appointment ? (
          <BookingsAppointmentPreview
            appointment={appointment}
            business={business}
            services={services}
            staffMembers={staffMembers}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">{t('bookings.preview.selectAppointment')}</p>
        )}
      </div>
    </div>
  )

  const floatWidth = Math.min(900, Math.max(300, Math.round(dockWidthPx)))
  const floatPos = useMemo(() => {
    const x = Math.max(12, window.innerWidth - floatWidth - 20)
    return { x, y: 68 }
  }, [floatWidth])

  if (!open) return null

  return (
    <>
      {placement === 'dock' ? (
        <>
          <VerticalSplitter
            ariaLabel={t('bookings.preview.splitterAria')}
            onDrag={onDockWidthDrag}
          />
          <aside
            className="flex min-h-0 shrink-0 flex-col border-l border-border bg-card"
            style={{ width: dockWidthPx }}
          >
            {chrome}
          </aside>
        </>
      ) : null}
      {placement === 'float' ? (
        <CalendarFloatingPanel
          open
          title={t('bookings.preview.heading')}
          widthPx={floatWidth}
          minHeightPx={360}
          persistSizeKey={BOOKINGS_FLOAT_PREVIEW_SIZE_KEY}
          defaultPosition={floatPos}
          zIndex={92}
          onClose={onClose}
          onDock={(): void => onPlacementChange('dock')}
        >
          {chrome}
        </CalendarFloatingPanel>
      ) : null}
    </>
  )
}
