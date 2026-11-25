import { useEffect, useState } from 'react'

/**
 * Outlook-Masterkategorie-Farben pro Anzeigename für das gegebene Konto.
 * Leer, wenn kein Konto / Laden fehlschlägt (z. B. Nicht-Microsoft).
 */
export function useAccountMasterCategoryColors(
  accountId: string | null | undefined
): Map<string, string> {
  const [map, setMap] = useState(() => new Map<string, string>())

  useEffect(() => {
    if (!accountId?.trim()) {
      setMap(new Map())
      return
    }
    let cancelled = false
    void window.mailClient.mail
      .listMasterCategories(accountId)
      .then((cats) => {
        if (cancelled) return
        const next = new Map<string, string>()
        for (const c of cats) {
          const name = c.displayName?.trim()
          if (!name) continue
          next.set(name, c.color)
        }
        setMap(next)
      })
      .catch(() => {
        if (!cancelled) setMap(new Map())
      })
    return (): void => {
      cancelled = true
    }
  }, [accountId])

  return map
}
