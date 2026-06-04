/** Welche Topbar-Tabs bei begrenzter Breite sichtbar bleiben (Rest → Dropdown). */

export function sumTabWidths(indices: readonly number[], tabWidths: readonly number[]): number {
  return indices.reduce((sum, i) => sum + (tabWidths[i] ?? 0), 0)
}

export function computeVisibleTopbarTabIndices(
  tabWidths: readonly number[],
  activeIndex: number,
  availableWidth: number,
  overflowButtonWidth: number
): { visible: Set<number>; needsOverflow: boolean } {
  const n = tabWidths.length
  if (n === 0) return { visible: new Set(), needsOverflow: false }

  const all = Array.from({ length: n }, (_, i) => i)

  const fits = (indices: readonly number[], reserveOverflow: boolean): boolean => {
    const budget = reserveOverflow
      ? Math.max(0, availableWidth - overflowButtonWidth)
      : availableWidth
    return sumTabWidths(indices, tabWidths) <= budget
  }

  if (fits(all, false)) {
    return { visible: new Set(all), needsOverflow: false }
  }

  const active = activeIndex >= 0 && activeIndex < n ? activeIndex : 0
  let visible = new Set(all)

  while (visible.size > 1) {
    const sorted = [...visible].sort((a, b) => a - b)
    if (fits(sorted, true)) {
      return { visible, needsOverflow: visible.size < n }
    }

    const removable = sorted.filter((i) => i !== active)
    if (removable.length === 0) break

    removable.sort((a, b) => {
      const dist = Math.abs(b - active) - Math.abs(a - active)
      if (dist !== 0) return dist
      return b - a
    })
    visible.delete(removable[0]!)
  }

  return { visible: new Set([active]), needsOverflow: n > 1 }
}
