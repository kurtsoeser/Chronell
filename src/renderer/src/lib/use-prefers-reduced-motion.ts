import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches
}

/** Respects OS "reduce motion" — animations should skip or use instant timing. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
