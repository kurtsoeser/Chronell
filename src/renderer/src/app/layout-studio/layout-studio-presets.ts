import {
  LAYOUT_STUDIO_DEFAULT_COLUMNS,
  createLayoutStudioColumn,
  type LayoutStudioColumn,
  type LayoutStudioPanelId
} from '@/app/layout-studio/layout-studio-storage'

export type LayoutStudioPresetId = 'default' | 'focusMail' | 'planning' | 'startAgenda'

export const LAYOUT_STUDIO_PRESET_IDS: LayoutStudioPresetId[] = [
  'default',
  'focusMail',
  'planning',
  'startAgenda'
]

function cols(
  specs: Array<{ panel: LayoutStudioPanelId; widthPx: number }>
): LayoutStudioColumn[] {
  return specs.map((s) => createLayoutStudioColumn(s.panel, s.widthPx))
}

const PRESET_BUILDERS: Record<LayoutStudioPresetId, () => LayoutStudioColumn[]> = {
  default: () => [...LAYOUT_STUDIO_DEFAULT_COLUMNS],
  focusMail: () =>
    cols([
      { panel: 'mailList', widthPx: 300 },
      { panel: 'reading', widthPx: 400 },
      { panel: 'contextSidebar', widthPx: 348 }
    ]),
  planning: () =>
    cols([
      { panel: 'agenda', widthPx: 320 },
      { panel: 'startDashboard', widthPx: 420 },
      { panel: 'contextSidebar', widthPx: 348 }
    ]),
  startAgenda: () =>
    cols([
      { panel: 'startDashboard', widthPx: 520 },
      { panel: 'agenda', widthPx: 340 }
    ])
}

export function applyLayoutStudioPreset(preset: LayoutStudioPresetId): LayoutStudioColumn[] {
  return PRESET_BUILDERS[preset]()
}
