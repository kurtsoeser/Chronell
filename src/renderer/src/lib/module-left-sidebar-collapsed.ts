import { useEffect, useState } from 'react'

export const MAIL_LEFT_SIDEBAR_COLLAPSED_KEY = 'mailclient.mail.leftSidebarCollapsed'
export const TASKS_LEFT_SIDEBAR_COLLAPSED_KEY = 'mailclient.tasks.leftSidebarCollapsed'
export const NOTES_LEFT_SIDEBAR_COLLAPSED_KEY = 'mailclient.notes.leftSidebarCollapsed'
export const FILES_LEFT_SIDEBAR_COLLAPSED_KEY = 'mailclient.files.leftSidebarCollapsed'
export const PEOPLE_LEFT_SIDEBAR_COLLAPSED_KEY = 'mailclient.people.leftSidebarCollapsed'

export function readModuleLeftSidebarCollapsed(
  storageKey: string,
  defaultCollapsed = false
): boolean {
  try {
    const v = window.localStorage.getItem(storageKey)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    // ignore
  }
  return defaultCollapsed
}

export function persistModuleLeftSidebarCollapsed(storageKey: string, collapsed: boolean): void {
  try {
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}

export function useModuleLeftSidebarCollapsed(
  storageKey: string,
  defaultCollapsed = false
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [collapsed, setCollapsed] = useState(() =>
    readModuleLeftSidebarCollapsed(storageKey, defaultCollapsed)
  )

  useEffect(() => {
    persistModuleLeftSidebarCollapsed(storageKey, collapsed)
  }, [storageKey, collapsed])

  return [collapsed, setCollapsed]
}
