import { tilePanelId, type LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import {
  clampZoneRatio,
  createZoneLeaf,
  newZoneId,
  type LayoutZoneNode,
  type LayoutZoneSplitDirection
} from '@/app/layout-studio/layout-zone-model'

export type LayoutZoneTemplateId =
  | 'single'
  | 'columns3'
  | 'rows3'
  | 'grid2x2'
  | 'priorityGrid'
  | 'todoSidebar'
  | 'notionSplit'
  | 'mailWorkbench'
  | 'planningDay'

export const LAYOUT_ZONE_TEMPLATE_IDS: LayoutZoneTemplateId[] = [
  'single',
  'columns3',
  'rows3',
  'grid2x2',
  'priorityGrid',
  'todoSidebar',
  'notionSplit',
  'mailWorkbench',
  'planningDay'
]

function leaf(panel: LayoutStudioPanelId = 'none'): LayoutZoneNode {
  return createZoneLeaf(panel)
}

function split(
  direction: LayoutZoneSplitDirection,
  ratio: number,
  first: LayoutZoneNode,
  second: LayoutZoneNode
): LayoutZoneNode {
  return {
    type: 'split',
    id: newZoneId(),
    direction,
    ratio: clampZoneRatio(ratio),
    first,
    second
  }
}

function equalSplits(
  direction: LayoutZoneSplitDirection,
  count: number,
  panels?: LayoutStudioPanelId[]
): LayoutZoneNode {
  let node: LayoutZoneNode = leaf(panels?.[count - 1] ?? 'none')
  for (let i = count - 2; i >= 0; i -= 1) {
    node = split(direction, 1 / (count - i), leaf(panels?.[i] ?? 'none'), node)
  }
  return node
}

const BUILDERS: Record<LayoutZoneTemplateId, () => LayoutZoneNode> = {
  single: () => leaf('startDashboard'),
  columns3: () => equalSplits('vertical', 3),
  rows3: () => equalSplits('horizontal', 3),
  grid2x2: () =>
    split(
      'vertical',
      0.5,
      split('horizontal', 0.5, leaf(), leaf()),
      split('horizontal', 0.5, leaf(), leaf())
    ),
  priorityGrid: () =>
    split(
      'vertical',
      0.2,
      leaf(),
      split('vertical', 0.75, leaf('startDashboard'), split('vertical', 0.5, leaf(), leaf()))
    ),
  todoSidebar: () =>
    split(
      'vertical',
      0.68,
      leaf('startDashboard'),
      split('horizontal', 0.55, leaf('agenda'), leaf('contextSidebar'))
    ),
  notionSplit: () => split('vertical', 0.62, leaf('reading'), leaf('contextSidebar')),
  mailWorkbench: () =>
    split(
      'vertical',
      0.18,
      leaf('mailFolders'),
      split(
        'vertical',
        0.32,
        leaf('mailList'),
        split('vertical', 0.55, leaf('contextPreview'), leaf('zeitliste'))
      )
    ),
  planningDay: () =>
    split(
      'vertical',
      0.38,
      split(
        'horizontal',
        0.55,
        leaf(tilePanelId('todo_today')),
        leaf(tilePanelId('inbox'))
      ),
      split('vertical', 0.5, leaf('calendarToday'), leaf('calendarWeek'))
    )
}

export function buildZoneTemplate(id: LayoutZoneTemplateId): LayoutZoneNode {
  return BUILDERS[id]()
}
