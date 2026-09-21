import type { Client } from '@microsoft/microsoft-graph-client'

interface GraphOnlineMeetingRow {
  id?: string
}

/** Join-URL-Varianten fuer Graph `$filter` / Bindungsschluessel. */
export function joinUrlLookupVariants(joinUrl: string): string[] {
  const trimmed = joinUrl.trim()
  if (!trimmed) return []

  const variants = new Set<string>([trimmed])

  try {
    const url = new URL(trimmed)
    variants.add(url.toString())

    const decodedPath = decodeURIComponent(url.pathname)
    if (decodedPath !== url.pathname) {
      const copy = new URL(url.toString())
      copy.pathname = decodedPath
      variants.add(copy.toString())
    }

    const normalized = trimmed.replace(/%3A/g, '%3a').replace(/%40/g, '%40')
    variants.add(normalized)

    const context = url.searchParams.get('context')
    if (context) {
      try {
        const parsed = JSON.parse(context) as { Tid?: string; Oid?: string }
        if (parsed.Tid && parsed.Oid) {
          const ordered = JSON.stringify({ Tid: parsed.Tid, Oid: parsed.Oid })
          const copy = new URL(url.toString())
          copy.searchParams.set('context', ordered)
          variants.add(copy.toString())
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return [...variants]
}

/** Online-Meeting-ID ueber JoinWebUrl finden (Teams). */
export async function graphFindOnlineMeetingId(
  client: Client,
  joinUrl: string
): Promise<string | null> {
  for (const variant of joinUrlLookupVariants(joinUrl)) {
    const escaped = variant.replace(/'/g, "''")
    try {
      const direct = (await client.api(`/me/onlineMeetings(joinWebUrl='${escaped}')`).get()) as GraphOnlineMeetingRow
      const id = direct?.id?.trim()
      if (id) return id
    } catch {
      // try filter next
    }

    try {
      const filter = `JoinWebUrl eq '${escaped}'`
      const meetings = (await client
        .api(`/me/onlineMeetings?$filter=${encodeURIComponent(filter)}`)
        .get()) as { value?: GraphOnlineMeetingRow[] }
      const id = meetings.value?.[0]?.id?.trim()
      if (id) return id
    } catch {
      // next variant
    }
  }
  return null
}
