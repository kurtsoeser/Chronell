import type { EntityRefKind } from '@shared/entity-ref'
import type { EntityGraphClusterMode } from '@shared/entity-links'
import { parseClusterIslandStyles, type ClusterIslandStyle } from '@/app/connections/cluster-island-style'

export type { ClusterIslandStyle }

export type GraphLinkKindFilter = 'all' | 'related' | 'derived_from' | 'suggested'

const CLUSTER_MODES: EntityGraphClusterMode[] = [
  'account',
  'kind',
  'scope',
  'component',
  'time_month',
  'time_week',
  'time_year',
  'domain',
  'company',
  'calendar_list',
  'task_list',
  'none'
]

function parseClusterSpacing(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_GRAPH_VIEW_SETTINGS.clusterSpacing
  return Math.min(2, Math.max(0, Math.round(value * 20) / 20))
}

function parseSavedGraphLayout(value: unknown): SavedGraphLayout | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<SavedGraphLayout>
  if (typeof v.structureKey !== 'string' || !v.structureKey) return null
  const nodePositions: Record<string, { x: number; y: number }> = {}
  if (v.nodePositions && typeof v.nodePositions === 'object') {
    for (const [key, pos] of Object.entries(v.nodePositions)) {
      if (!pos || typeof pos !== 'object') continue
      const x = (pos as { x?: unknown }).x
      const y = (pos as { y?: unknown }).y
      if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
        nodePositions[key] = { x, y }
      }
    }
  }
  if (Object.keys(nodePositions).length === 0) return null
  return { structureKey: v.structureKey, nodePositions }
}

function parseClusterMode(value: unknown): EntityGraphClusterMode {
  if (typeof value === 'string' && CLUSTER_MODES.includes(value as EntityGraphClusterMode)) {
    return value as EntityGraphClusterMode
  }
  return 'component'
}

/** Gespeicherter Graph-Stand (Knotenpositionen inkl. manueller Insel-Verschiebungen). */
export interface SavedGraphLayout {
  structureKey: string
  nodePositions: Record<string, { x: number; y: number }>
}

export interface ConnectionsGraphViewSettings {
  clusterMode: EntityGraphClusterMode
  /** Eigene Namen für Verbindungs-Inseln (`comp:<anker-knoten-key>`, z. B. `comp:mail:42`). */
  componentIslandLabels: Record<string, string>
  /** Eigene Farben für Gruppierungs-Inseln (mit Transparenz). */
  clusterIslandStyles: Record<string, ClusterIslandStyle>
  /** Manuelle Verschiebung ganzer Gruppierungs-Inseln (Graph-Koordinaten). */
  clusterIslandOffsets: Record<string, { dx: number; dy: number }>
  /** Letzter gespeicherter Layout-Stand für eine Graph-Struktur. */
  savedGraphLayout: SavedGraphLayout | null
  edgeThickness: number
  /** Insel-/Gruppen-Abstand im Layout (1 = Standard; kleiner = kompakter). */
  clusterSpacing: number
  hideOrphans: boolean
  hiddenKinds: Partial<Record<EntityRefKind, boolean>>
  accountFilter: string | null
  focusDepth: 0 | 1 | 2
  titleFilter: string
  linkKindFilter: GraphLinkKindFilter
  kindColors: Partial<Record<EntityRefKind, string>>
}

export const DEFAULT_GRAPH_VIEW_SETTINGS: ConnectionsGraphViewSettings = {
  clusterMode: 'component',
  componentIslandLabels: {},
  clusterIslandStyles: {},
  clusterIslandOffsets: {},
  savedGraphLayout: null,
  edgeThickness: 1,
  clusterSpacing: 1,
  hideOrphans: false,
  hiddenKinds: {},
  accountFilter: null,
  focusDepth: 0,
  titleFilter: '',
  linkKindFilter: 'all',
  kindColors: {}
}

const STORAGE_KEY = 'mailclient.connections.graphView'

export function loadGraphViewSettings(): ConnectionsGraphViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GRAPH_VIEW_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ConnectionsGraphViewSettings>
    return {
      ...DEFAULT_GRAPH_VIEW_SETTINGS,
      ...parsed,
      clusterMode: parseClusterMode(parsed.clusterMode),
      clusterSpacing: parseClusterSpacing(parsed.clusterSpacing),
      componentIslandLabels: {
        ...DEFAULT_GRAPH_VIEW_SETTINGS.componentIslandLabels,
        ...(parsed.componentIslandLabels ?? {})
      },
      clusterIslandStyles: {
        ...DEFAULT_GRAPH_VIEW_SETTINGS.clusterIslandStyles,
        ...parseClusterIslandStyles(parsed.clusterIslandStyles)
      },
      clusterIslandOffsets: {
        ...DEFAULT_GRAPH_VIEW_SETTINGS.clusterIslandOffsets,
        ...(parsed.clusterIslandOffsets ?? {})
      },
      savedGraphLayout: parseSavedGraphLayout(parsed.savedGraphLayout),
      hiddenKinds: { ...DEFAULT_GRAPH_VIEW_SETTINGS.hiddenKinds, ...parsed.hiddenKinds },
      kindColors: { ...DEFAULT_GRAPH_VIEW_SETTINGS.kindColors, ...parsed.kindColors }
    }
  } catch {
    return { ...DEFAULT_GRAPH_VIEW_SETTINGS }
  }
}

export function saveGraphViewSettings(settings: ConnectionsGraphViewSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore quota */
  }
}
