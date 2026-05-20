import type { TFunction } from 'i18next'
import type { EntityRefKind } from '@shared/entity-ref'
import type { ConnectedAccount } from '@shared/types'

export function clusterLabelForKey(
  clusterKey: string,
  t: TFunction,
  accounts: readonly ConnectedAccount[],
  componentIslandLabels?: Readonly<Record<string, string>>,
  listClusterLabels?: Readonly<Record<string, string>>
): string {
  if (clusterKey === 'all') {
    return t('connections.graph.clusterNone')
  }
  if (clusterKey.startsWith('account:')) {
    const id = clusterKey.slice('account:'.length)
    const acc = accounts.find((a) => a.id === id)
    return acc?.displayName?.trim() || acc?.email?.trim() || id
  }
  if (clusterKey.startsWith('kind:')) {
    const kind = clusterKey.slice('kind:'.length) as EntityRefKind
    return t(`connections.kind.${kind}`)
  }
  if (clusterKey.startsWith('comp:')) {
    const custom = componentIslandLabels?.[clusterKey]?.trim()
    if (custom) return custom
    const suffix = clusterKey.slice('comp:'.length)
    if (/^\d+$/.test(suffix)) {
      return t('connections.graph.clusterComponent', { n: Number(suffix) + 1 })
    }
    return t('connections.graph.clusterComponent', { n: 1 })
  }
  if (clusterKey.startsWith('time:')) {
    const raw = clusterKey.slice('time:'.length)
    if (raw === 'unknown') return t('connections.graph.clusterTimeUnknown')
    const [y, m] = raw.split('-')
    return t('connections.graph.clusterTimeMonth', { year: y, month: m })
  }
  if (clusterKey.startsWith('week:')) {
    const raw = clusterKey.slice('week:'.length)
    if (raw === 'unknown') return t('connections.graph.clusterTimeUnknown')
    const m = /^(\d{4})-W(\d{2})$/.exec(raw)
    if (m) {
      return t('connections.graph.clusterTimeWeek', {
        year: m[1],
        week: Number(m[2])
      })
    }
    return raw
  }
  if (clusterKey.startsWith('year:')) {
    const y = clusterKey.slice('year:'.length)
    if (y === 'unknown') return t('connections.graph.clusterTimeUnknown')
    return y
  }
  if (clusterKey.startsWith('domain:')) {
    const d = clusterKey.slice('domain:'.length)
    return d === 'unknown' ? t('connections.graph.clusterDomainUnknown') : d
  }
  if (clusterKey.startsWith('company:')) {
    const c = clusterKey.slice('company:'.length)
    return c === 'unknown'
      ? t('connections.graph.clusterCompanyUnknown')
      : c.charAt(0).toUpperCase() + c.slice(1)
  }
  if (clusterKey.startsWith('cal:')) {
    if (clusterKey === 'cal:unknown') return t('connections.graph.clusterListUnknown')
    const named = listClusterLabels?.[clusterKey]?.trim()
    if (named) return named
    const rest = clusterKey.slice('cal:'.length)
    const colon = rest.indexOf(':')
    if (colon > 0) return rest.slice(colon + 1) || clusterKey
    return clusterKey
  }
  if (clusterKey.startsWith('tasklist:')) {
    if (clusterKey === 'tasklist:unknown') return t('connections.graph.clusterListUnknown')
    const named = listClusterLabels?.[clusterKey]?.trim()
    if (named) return named
    const rest = clusterKey.slice('tasklist:'.length)
    const colon = rest.indexOf(':')
    if (colon > 0) return rest.slice(colon + 1) || clusterKey
    return clusterKey
  }
  switch (clusterKey) {
    case 'scope:notes':
      return t('connections.graph.clusterNotes')
    case 'scope:contacts':
      return t('connections.graph.clusterContacts')
    case 'scope:mail':
      return t('connections.graph.clusterMail')
    case 'scope:calendar':
      return t('connections.graph.clusterCalendar')
    case 'scope:tasks':
      return t('connections.graph.clusterTasks')
    default:
      return clusterKey
  }
}
