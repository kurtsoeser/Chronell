import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { modulePaneStackClass, moduleShellClass } from '@/components/module-shell-layout'
import { cn } from '@/lib/utils'
import { LayoutZoneTree } from '@/app/layout-studio/LayoutZoneTree'
import { LayoutZoneTemplatePickerDialog } from '@/app/layout-studio/LayoutZoneTemplatePickerDialog'
import type { LayoutZoneTemplateId } from '@/app/layout-studio/layout-zone-templates'
import { useCustomViewZonePopout } from '@/app/custom-views/use-custom-view-zone-popout'
import { useCustomViewsStore } from '@/stores/custom-views'

export function CustomViewShell(): JSX.Element {
  const { t } = useTranslation()

  const activeViewId = useCustomViewsStore((s) => s.activeViewId)
  const editMode = useCustomViewsStore((s) => s.editMode)
  const selectedLeafId = useCustomViewsStore((s) => s.selectedLeafId)
  const templatePickerOpen = useCustomViewsStore((s) => s.templatePickerOpen)
  const view = useCustomViewsStore((s) =>
    s.activeViewId ? s.views.find((v) => v.id === s.activeViewId) : undefined
  )

  const setEditMode = useCustomViewsStore((s) => s.setEditMode)
  const setTemplatePickerOpen = useCustomViewsStore((s) => s.setTemplatePickerOpen)
  const setSelectedLeafId = useCustomViewsStore((s) => s.setSelectedLeafId)
  const setActiveViewZonePanel = useCustomViewsStore((s) => s.setActiveViewZonePanel)
  const swapActiveViewZonePanels = useCustomViewsStore((s) => s.swapActiveViewZonePanels)
  const splitActiveViewZone = useCustomViewsStore((s) => s.splitActiveViewZone)
  const removeActiveViewZone = useCustomViewsStore((s) => s.removeActiveViewZone)
  const adjustActiveViewZoneRatio = useCustomViewsStore((s) => s.adjustActiveViewZoneRatio)
  const applyActiveViewTemplate = useCustomViewsStore((s) => s.applyActiveViewTemplate)

  const zoneRoot = view?.zoneRoot
  const zonePopout = useCustomViewZonePopout(activeViewId)

  const onPickTemplate = useCallback(
    (id: LayoutZoneTemplateId | 'custom'): void => {
      if (id === 'custom') applyActiveViewTemplate('single')
      else applyActiveViewTemplate(id)
      setEditMode(true)
      setTemplatePickerOpen(false)
    },
    [applyActiveViewTemplate, setEditMode, setTemplatePickerOpen]
  )

  if (!activeViewId || !view || !zoneRoot) {
    return (
      <div className={cn(moduleShellClass, 'items-center justify-center p-8 text-sm text-muted-foreground')}>
        {t('customView.missing')}
      </div>
    )
  }

  return (
    <div className={cn(moduleShellClass, 'flex-col')}>
      <div className={cn(modulePaneStackClass, 'min-h-0 flex-1')}>
        <LayoutZoneTree
          key={`${activeViewId}-${editMode ? 'edit' : 'view'}`}
          root={zoneRoot}
          editMode={editMode}
          selectedLeafId={selectedLeafId}
          zonePopout={zonePopout}
          onSelectLeaf={setSelectedLeafId}
          onSetPanel={setActiveViewZonePanel}
          onSwapPanels={swapActiveViewZonePanels}
          onSplitLeaf={splitActiveViewZone}
          onRemoveLeaf={removeActiveViewZone}
          onAdjustRatio={adjustActiveViewZoneRatio}
        />
      </div>

      <LayoutZoneTemplatePickerDialog
        open={templatePickerOpen}
        onClose={(): void => setTemplatePickerOpen(false)}
        onPick={onPickTemplate}
      />
    </div>
  )
}
