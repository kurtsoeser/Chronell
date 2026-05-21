import type { PeopleListSort } from '@shared/types'

export const PEOPLE_SORT_STORAGE_KEY = 'mailclient.people.sortBy'

export const PEOPLE_SORT_CHANGED_EVENT = 'mailclient:people-sort-changed'

export function readStoredPeopleSort(): PeopleListSort {
  try {
    const v = window.localStorage.getItem(PEOPLE_SORT_STORAGE_KEY)
    if (v === 'givenName' || v === 'surname' || v === 'displayName') return v
  } catch {
    /* ignore */
  }
  return 'displayName'
}

export function writeStoredPeopleSort(next: PeopleListSort): void {
  try {
    window.localStorage.setItem(PEOPLE_SORT_STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(PEOPLE_SORT_CHANGED_EVENT))
}
