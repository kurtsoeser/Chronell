import { useCallback, useEffect, useRef, useState } from 'react'
import type { MailCorrespondenceItem } from '@shared/types'
import {
  getContactHistoryPreviewCached,
  setContactHistoryPreviewCached,
  type ContactHistoryPreviewPayload
} from '@/app/layout/mail-right-sidebar/contact-history-preview-cache'

const HOVER_OPEN_MS = 320
const HOVER_CLOSE_MS = 200
const PANEL_WIDTH = 400

export interface ContactHistoryHoverAnchor {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface ContactHistoryHoverPanelRect {
  top: number
  left: number
  width: number
  maxHeight: number
}

export interface ContactHistoryHoverState {
  item: MailCorrespondenceItem
  anchor: ContactHistoryHoverAnchor
  panel: ContactHistoryHoverPanelRect
  payload: ContactHistoryPreviewPayload | null
  loading: boolean
  error: string | null
}

function anchorFromDomRect(rect: DOMRect): ContactHistoryHoverAnchor {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  }
}

export function computeContactHistoryHoverPanelRect(
  anchor: ContactHistoryHoverAnchor
): ContactHistoryHoverPanelRect {
  const gap = 12
  const margin = 8
  const maxHeight = Math.min(480, window.innerHeight - margin * 2)
  let left = anchor.left - PANEL_WIDTH - gap
  if (left < margin) {
    left = Math.min(anchor.right + gap, window.innerWidth - PANEL_WIDTH - margin)
  }
  let top = anchor.top
  if (top + maxHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - margin - maxHeight)
  }
  if (top < margin) top = margin
  return { top, left, width: PANEL_WIDTH, maxHeight }
}

async function fetchPreviewPayload(
  messageId: number,
  signal: AbortSignal
): Promise<ContactHistoryPreviewPayload> {
  const cached = getContactHistoryPreviewCached(messageId)
  if (cached) return cached

  const [message, attachments] = await Promise.all([
    window.mailClient.mail.getMessage(messageId),
    window.mailClient.mail.listAttachments(messageId)
  ])
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (!message) throw new Error('Message not found')

  const visible = attachments.filter((a) => {
    if (a.isInline) return false
    if ((a.size ?? 0) > 0 && (a.size ?? 0) < 200) return false
    return true
  })

  let inlineImages: Record<string, string> = {}
  const needsInline =
    Boolean(message.bodyHtml?.trim()) && attachments.some((a) => a.isInline)
  if (needsInline) {
    try {
      inlineImages = await window.mailClient.mail.fetchInlineImages(messageId)
    } catch {
      inlineImages = {}
    }
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const payload: ContactHistoryPreviewPayload = { message, attachments: visible, inlineImages }
  setContactHistoryPreviewCached(messageId, payload)
  return payload
}

export function useContactHistoryHoverPreview(): {
  hover: ContactHistoryHoverState | null
  onRowMouseEnter: (item: MailCorrespondenceItem, el: HTMLElement) => void
  onRowMouseLeave: () => void
  onPanelMouseEnter: () => void
  onPanelMouseLeave: () => void
  dismiss: () => void
} {
  const [hover, setHover] = useState<ContactHistoryHoverState | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const panelPinnedRef = useRef(false)
  const anchorElRef = useRef<HTMLElement | null>(null)
  const pendingItemRef = useRef<{
    item: MailCorrespondenceItem
    anchor: ContactHistoryHoverAnchor
  } | null>(null)

  const clearOpenTimer = useCallback((): void => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }, [])

  const clearCloseTimer = useCallback((): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const abortFetch = useCallback((): void => {
    fetchAbortRef.current?.abort()
    fetchAbortRef.current = null
  }, [])

  const dismiss = useCallback((): void => {
    clearOpenTimer()
    clearCloseTimer()
    abortFetch()
    panelPinnedRef.current = false
    anchorElRef.current = null
    pendingItemRef.current = null
    setHover(null)
  }, [abortFetch, clearCloseTimer, clearOpenTimer])

  const startLoad = useCallback(
    (item: MailCorrespondenceItem, anchor: ContactHistoryHoverAnchor): void => {
      abortFetch()
      const cached = getContactHistoryPreviewCached(item.id)
      const panel = computeContactHistoryHoverPanelRect(anchor)
      setHover({
        item,
        anchor,
        panel,
        payload: cached,
        loading: !cached,
        error: null
      })

      if (cached) return

      const ac = new AbortController()
      fetchAbortRef.current = ac
      void fetchPreviewPayload(item.id, ac.signal)
        .then((payload) => {
          if (ac.signal.aborted) return
          setHover((prev) => {
            if (!prev || prev.item.id !== item.id) return prev
            return { ...prev, payload, loading: false, error: null }
          })
        })
        .catch((e) => {
          if (ac.signal.aborted) return
          const msg = e instanceof Error ? e.message : String(e)
          setHover((prev) => {
            if (!prev || prev.item.id !== item.id) return prev
            return { ...prev, loading: false, error: msg }
          })
        })
        .finally(() => {
          if (fetchAbortRef.current === ac) fetchAbortRef.current = null
        })
    },
    [abortFetch]
  )

  const onRowMouseEnter = useCallback(
    (item: MailCorrespondenceItem, el: HTMLElement): void => {
      clearCloseTimer()
      panelPinnedRef.current = false
      anchorElRef.current = el
      const rect = el.getBoundingClientRect()
      const anchor = anchorFromDomRect(rect)
      pendingItemRef.current = { item, anchor }

      clearOpenTimer()
      openTimerRef.current = setTimeout(() => {
        openTimerRef.current = null
        const pending = pendingItemRef.current
        if (!pending || pending.item.id !== item.id) return
        startLoad(item, anchor)
      }, HOVER_OPEN_MS)
    },
    [clearCloseTimer, clearOpenTimer, startLoad]
  )

  const onRowMouseLeave = useCallback((): void => {
    clearOpenTimer()
    pendingItemRef.current = null
    if (panelPinnedRef.current) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      dismiss()
    }, HOVER_CLOSE_MS)
  }, [clearCloseTimer, clearOpenTimer, dismiss])

  const onPanelMouseEnter = useCallback((): void => {
    panelPinnedRef.current = true
    clearCloseTimer()
  }, [clearCloseTimer])

  const onPanelMouseLeave = useCallback((): void => {
    panelPinnedRef.current = false
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      dismiss()
    }, HOVER_CLOSE_MS)
  }, [clearCloseTimer, dismiss])

  useEffect(() => {
    const reposition = (): void => {
      const el = anchorElRef.current
      if (!el) return
      const anchor = anchorFromDomRect(el.getBoundingClientRect())
      const panel = computeContactHistoryHoverPanelRect(anchor)
      setHover((prev) => (prev ? { ...prev, anchor, panel } : null))
    }
    const onResize = (): void => dismiss()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', onResize)
    return (): void => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', onResize)
    }
  }, [dismiss])

  return {
    hover,
    onRowMouseEnter,
    onRowMouseLeave,
    onPanelMouseEnter,
    onPanelMouseLeave,
    dismiss
  }
}
