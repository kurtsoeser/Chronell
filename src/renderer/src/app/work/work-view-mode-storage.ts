export type WorkContentViewMode = 'list' | 'kanban' | 'workflow'

const KEY = 'mailclient.work.contentViewMode.v1'

export function readWorkContentViewMode(): WorkContentViewMode {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === 'kanban') return 'kanban'
    if (raw === 'workflow') return 'workflow'
    return 'list'
  } catch {
    return 'list'
  }
}

export function persistWorkContentViewMode(mode: WorkContentViewMode): void {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}
