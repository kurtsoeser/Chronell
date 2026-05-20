import type { EntityGraphClusterMode, EntityGraphNode } from '@shared/entity-links'

export function resolveLayoutClusterKey(
  node: EntityGraphNode,
  clusterMode: EntityGraphClusterMode,
  componentKey?: string
): string {
  switch (clusterMode) {
    case 'kind':
      return `kind:${node.kind}`
    case 'account':
      return node.clusterKey ?? `kind:${node.kind}`
    case 'scope':
      return node.layoutScope ?? node.clusterKey
    case 'none':
      return 'all'
    case 'component':
      return componentKey ?? 'comp:0'
    case 'time_month':
      return node.layoutTimeMonth ? `time:${node.layoutTimeMonth}` : 'time:unknown'
    case 'time_week':
      return node.layoutTimeWeek ? `week:${node.layoutTimeWeek}` : 'time:unknown'
    case 'time_year':
      return node.layoutTimeYear ? `year:${node.layoutTimeYear}` : 'time:unknown'
    case 'domain':
      return node.layoutDomain ? `domain:${node.layoutDomain}` : 'domain:unknown'
    case 'company':
      return node.layoutCompany ?? 'company:unknown'
    case 'calendar_list':
      return node.layoutCalendarList ?? 'cal:unknown'
    case 'task_list':
      return node.layoutTaskList ?? 'tasklist:unknown'
    default:
      return node.clusterKey
  }
}
