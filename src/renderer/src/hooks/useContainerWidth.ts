import { useEffect, useRef, useState, type RefObject } from 'react'

/** Beobachtet die Breite eines Containers (z. B. fuer responsive Listenlayouts). */
export function useContainerWidth<T extends HTMLElement>(): {
  ref: RefObject<T | null>
  width: number
} {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = (): void => {
      setWidth(el.getBoundingClientRect().width)
    }
    measure()

    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [])

  return { ref, width }
}
