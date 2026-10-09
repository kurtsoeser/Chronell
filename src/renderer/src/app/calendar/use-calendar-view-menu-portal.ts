import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from 'react'

export function useCalendarViewMenuPortal(
  viewMenuOpen: boolean,
  onClose: () => void
): {
  btnRef: RefObject<HTMLButtonElement>
  panelRef: RefObject<HTMLDivElement>
  panelStyle: CSSProperties
} {
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!viewMenuOpen || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxH = Math.max(160, vh - r.bottom - 12)
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + 4,
      right: Math.max(8, vw - r.right),
      maxWidth: vw - 16,
      maxHeight: maxH,
      overflowY: 'auto',
      zIndex: 500
    })
  }, [viewMenuOpen])

  useEffect(() => {
    if (!viewMenuOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return (): void => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [viewMenuOpen, onClose])

  return { btnRef, panelRef, panelStyle }
}
