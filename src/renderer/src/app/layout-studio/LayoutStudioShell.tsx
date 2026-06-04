import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { modulePaneStackClass, moduleShellClass } from '@/components/module-shell-layout'
import { cn } from '@/lib/utils'
import { LayoutZoneTree } from '@/app/layout-studio/LayoutZoneTree'
import { LayoutZoneEditorToolbar } from '@/app/layout-studio/LayoutZoneEditorToolbar'
import { LayoutZoneTemplatePickerDialog } from '@/app/layout-studio/LayoutZoneTemplatePickerDialog'
import {
  buildZoneTemplate,
  type LayoutZoneTemplateId
} from '@/app/layout-studio/layout-zone-templates'
import { useLayoutStudioStore } from '@/stores/layout-studio-store'

export function LayoutStudioShell(): JSX.Element {
  const { t } = useTranslation()
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const zoneRoot = useLayoutStudioStore((s) => s.zoneRoot)
  const layoutName = useLayoutStudioStore((s) => s.layoutName)
  const editMode = useLayoutStudioStore((s) => s.editMode)
  const selectedLeafId = useLayoutStudioStore((s) => s.selectedLeafId)
  const setLayoutName = useLayoutStudioStore((s) => s.setLayoutName)
  const setEditMode = useLayoutStudioStore((s) => s.setEditMode)
  const setSelectedLeafId = useLayoutStudioStore((s) => s.setSelectedLeafId)
  const setZonePanel = useLayoutStudioStore((s) => s.setZonePanel)
  const swapZonePanels = useLayoutStudioStore((s) => s.swapZonePanels)
  const splitZone = useLayoutStudioStore((s) => s.splitZone)
  const removeZone = useLayoutStudioStore((s) => s.removeZone)
  const adjustZoneRatio = useLayoutStudioStore((s) => s.adjustZoneRatio)
  const applyZoneTemplate = useLayoutStudioStore((s) => s.applyZoneTemplate)
  const resetLayout = useLayoutStudioStore((s) => s.resetLayout)

  const onNewCustomLayout = useCallback((): void => {
    useLayoutStudioStore.getState().setZoneRoot(buildZoneTemplate('single'))
    useLayoutStudioStore.getState().setLayoutName(
      t('layoutStudio.customLayoutDefaultName', {
        n: Math.max(1, Math.floor(Math.random() * 9) + 1)
      })
    )
    setEditMode(true)
  }, [setEditMode, t])

  const onPickTemplate = useCallback(
    (id: LayoutZoneTemplateId | 'custom'): void => {
      if (id === 'custom') onNewCustomLayout()
      else applyZoneTemplate(id)
      setEditMode(true)
    },
    [applyZoneTemplate, onNewCustomLayout, setEditMode]
  )

  return (
    <div className={cn(moduleShellClass, 'flex-col')}>
      <LayoutZoneEditorToolbar
        title={t('layoutStudio.title')}
        subtitle={t('layoutStudio.subtitleZones')}
        name={layoutName}
        onNameChange={setLayoutName}
        editMode={editMode}
        onToggleEditMode={(): void => setEditMode(!editMode)}
        onChooseLayout={(): void => setTemplatePickerOpen(true)}
        onRevertLayout={resetLayout}
        revertLabel={t('layoutStudio.resetLayout')}
      />

      <div className={cn(modulePaneStackClass, 'min-h-0 flex-1')}>
        <LayoutZoneTree
          root={zoneRoot}
          editMode={editMode}
          selectedLeafId={selectedLeafId}
          onSelectLeaf={setSelectedLeafId}
          onSetPanel={setZonePanel}
          onSwapPanels={swapZonePanels}
          onSplitLeaf={splitZone}
          onRemoveLeaf={removeZone}
          onAdjustRatio={adjustZoneRatio}
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
