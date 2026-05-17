import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedToast } from '@/components/motion/AnimatedToast'
import { MOTION_TOAST_EXIT_MS } from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { useUndoStore } from '@/stores/undo'

/**
 * Globaler Toast-Stack unten rechts. Wird durch `useUndoStore.pushToast()`
 * gefuettert. Zusaetzlich registrieren wir hier den globalen Strg+Z-Shortcut
 * fuer "letzte Aktion zuruecknehmen".
 */
export function ToastStack(): JSX.Element {
  const toasts = useUndoStore((s) => s.toasts)
  const dismissToast = useUndoStore((s) => s.dismissToast)
  const undoLast = useUndoStore((s) => s.undoLast)
  const reducedMotion = usePrefersReducedMotion()
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(() => new Set())
  const autoTimersRef = useRef<Map<number, number>>(new Map())

  const requestDismiss = useCallback(
    (id: number): void => {
      if (reducedMotion) {
        dismissToast(id)
        return
      }
      setDismissingIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    [dismissToast, reducedMotion]
  )

  const onExitComplete = useCallback(
    (id: number): void => {
      dismissToast(id)
      setDismissingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [dismissToast]
  )

  useEffect(() => {
    const timers = autoTimersRef.current
    const toastIds = new Set(toasts.map((t) => t.id))

    for (const t of toasts) {
      if (t.durationMs <= 0 || timers.has(t.id)) continue
      const delay = Math.max(0, t.durationMs - MOTION_TOAST_EXIT_MS)
      const timer = window.setTimeout(() => requestDismiss(t.id), delay)
      timers.set(t.id, timer)
    }

    for (const [id, timer] of timers) {
      if (!toastIds.has(id)) {
        window.clearTimeout(timer)
        timers.delete(id)
      }
    }

    return (): void => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [toasts, requestDismiss])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null
      if (target) {
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        if (isInput) return
      }
      const isCtrlZ = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      if (isCtrlZ) {
        e.preventDefault()
        void undoLast()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [undoLast])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col items-stretch gap-2">
      {toasts.map((t) => {
        const Icon =
          t.variant === 'success' ? CheckCircle2 : t.variant === 'error' ? AlertCircle : Info
        return (
          <AnimatedToast
            key={t.id}
            toastId={t.id}
            dismissing={dismissingIds.has(t.id)}
            onExitComplete={onExitComplete}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-lg backdrop-blur transition-transform duration-200',
              t.variant === 'success' && 'border-emerald-500/30',
              t.variant === 'error' && 'border-destructive/40',
              t.variant === 'info' && 'border-border'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                t.variant === 'success' && 'text-emerald-400 animate-toast-check-pop',
                t.variant === 'error' && 'text-destructive',
                t.variant === 'info' && 'text-muted-foreground'
              )}
            />
            <span className="flex-1 leading-snug text-foreground">{t.label}</span>
            {t.onUndo && (
              <button
                type="button"
                onClick={(): void => {
                  requestDismiss(t.id)
                  void Promise.resolve(t.onUndo?.())
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
                title="Rueckgaengig (Strg+Z)"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={(): void => requestDismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Schliessen"
            >
              <X className="h-3 w-3" />
            </button>
          </AnimatedToast>
        )
      })}
    </div>
  )
}
