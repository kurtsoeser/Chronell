import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { computeVisibleTopbarTabIndices } from '@/app/layout/topbar-tabs-visible'
import type { TopbarTabId } from '@/app/layout/topbar-tab-order'

const DEFAULT_OVERFLOW_BTN_WIDTH = 44

export function useTopbarTabsOverflow(
  entryCount: number,
  activeTabId: TopbarTabId,
  tabIds: readonly TopbarTabId[],
  measureKey: string
): {
  navRef: React.Ref<HTMLElement>
  measureRef: React.Ref<HTMLDivElement>
  overflowMeasureRef: React.Ref<HTMLButtonElement>
  createBtnRef: React.Ref<HTMLButtonElement>
  visibleIndices: Set<number>
  showOverflow: boolean
} {
  const navRef = useRef<HTMLElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const overflowMeasureRef = useRef<HTMLButtonElement | null>(null)
  const createBtnRef = useRef<HTMLButtonElement | null>(null)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(() => new Set())
  const [showOverflow, setShowOverflow] = useState(false)

  const recompute = useCallback((): void => {
    const nav = navRef.current
    const measure = measureRef.current
    if (!nav || !measure || entryCount === 0) {
      setVisibleIndices(new Set())
      setShowOverflow(false)
      return
    }

    const tabWidths = Array.from(measure.children).map((el) =>
      (el as HTMLElement).getBoundingClientRect().width
    )
    if (tabWidths.length !== entryCount) return

    const createW = createBtnRef.current?.getBoundingClientRect().width ?? 0
    const overflowW =
      overflowMeasureRef.current?.getBoundingClientRect().width ?? DEFAULT_OVERFLOW_BTN_WIDTH
    const available = Math.max(0, nav.clientWidth - createW)
    const activeIndex = tabIds.indexOf(activeTabId)

    const { visible, needsOverflow } = computeVisibleTopbarTabIndices(
      tabWidths,
      activeIndex,
      available,
      overflowW
    )
    setVisibleIndices(visible)
    setShowOverflow(needsOverflow)
  }, [activeTabId, entryCount, tabIds])

  useLayoutEffect(() => {
    recompute()
  }, [recompute, measureKey])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(nav)
    const measure = measureRef.current
    if (measure) ro.observe(measure)
    return (): void => ro.disconnect()
  }, [recompute])

  return {
    navRef,
    measureRef,
    overflowMeasureRef,
    createBtnRef,
    visibleIndices,
    showOverflow
  }
}
