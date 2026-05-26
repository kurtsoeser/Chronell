export type FavoriteCategoryRef = {
  /** `null` = kontoübergreifend (Name matcht in allen Konten). */
  accountId: string | null
  name: string
}

const STORAGE_KEY = 'mailclient.mail.categoryFavorites.v1'
export const MAIL_CATEGORY_FAVORITES_CHANGED_EVENT = 'mail:category-favorites-changed'

function normalize(ref: FavoriteCategoryRef): FavoriteCategoryRef | null {
  const name = (ref.name ?? '').trim()
  if (!name) return null
  return { accountId: ref.accountId ?? null, name }
}

export function readFavoriteCategories(): FavoriteCategoryRef[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: FavoriteCategoryRef[] = []
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const r = x as Partial<FavoriteCategoryRef>
      const normed = normalize({
        accountId: typeof r.accountId === 'string' ? r.accountId : null,
        name: typeof r.name === 'string' ? r.name : ''
      })
      if (normed) out.push(normed)
    }
    // dedupe in-order
    const seen = new Set<string>()
    const deduped: FavoriteCategoryRef[] = []
    for (const r of out) {
      const key = `${r.accountId ?? '*'}::${r.name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(r)
    }
    return deduped
  } catch {
    return []
  }
}

export function persistFavoriteCategories(favs: FavoriteCategoryRef[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(MAIL_CATEGORY_FAVORITES_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function toggleFavoriteCategory(
  current: FavoriteCategoryRef[],
  ref: FavoriteCategoryRef,
  value?: boolean
): FavoriteCategoryRef[] {
  const normed = normalize(ref)
  if (!normed) return current
  const key = `${normed.accountId ?? '*'}::${normed.name.toLowerCase()}`
  const has = current.some(
    (x) => `${x.accountId ?? '*'}::${x.name.toLowerCase()}` === key
  )
  const want = value ?? !has
  if (want && !has) return [...current, normed]
  if (!want && has)
    return current.filter((x) => `${x.accountId ?? '*'}::${x.name.toLowerCase()}` !== key)
  return current
}

