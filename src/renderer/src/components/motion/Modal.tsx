import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  MOTION_OVERLAY_EXIT_MS,
  motionOverlayIn,
  motionOverlayOut,
  motionDrawerIn,
  motionDrawerOut,
  motionPanelIn,
  motionPanelOut
} from '@/lib/motion'
import { useAnimatedPresence } from '@/lib/use-animated-presence'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const ModalPresenceContext = createContext({ exiting: false })

interface ModalRootProps {
  open: boolean
  onBackdropClick?: () => void
  zIndex?: number
  overlayClassName?: string
  centerClassName?: string
  children: ReactNode
}

/** Portal overlay with enter/exit fade. Wrap {@link ModalPanel} as child. */
export function ModalRoot({
  open,
  onBackdropClick,
  zIndex = 300,
  overlayClassName,
  centerClassName,
  children
}: ModalRootProps): JSX.Element | null {
  const { mounted, exiting } = useAnimatedPresence(open, MOTION_OVERLAY_EXIT_MS)
  const reducedMotion = usePrefersReducedMotion()

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <ModalPresenceContext.Provider value={{ exiting }}>
      <div
        className={cn(
          'fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm',
          centerClassName,
          !reducedMotion && (exiting ? motionOverlayOut : motionOverlayIn),
          overlayClassName
        )}
        style={{ zIndex }}
        role="presentation"
        onClick={onBackdropClick}
      >
        {children}
      </div>
    </ModalPresenceContext.Provider>,
    document.body
  )
}

export type ModalPanelVariant = 'center' | 'drawer-right'

interface ModalPanelProps {
  className?: string
  variant?: ModalPanelVariant
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
  role?: string
  'aria-modal'?: boolean | 'true' | 'false'
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function ModalPanel({
  className,
  variant = 'center',
  children,
  onClick,
  ...aria
}: ModalPanelProps): JSX.Element {
  const { exiting } = useContext(ModalPresenceContext)
  const reducedMotion = usePrefersReducedMotion()
  const motionIn = variant === 'drawer-right' ? motionDrawerIn : motionPanelIn
  const motionOut = variant === 'drawer-right' ? motionDrawerOut : motionPanelOut

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(className, !reducedMotion && (exiting ? motionOut : motionIn))}
      onClick={(e): void => {
        e.stopPropagation()
        onClick?.(e)
      }}
      {...aria}
    >
      {children}
    </div>
  )
}
