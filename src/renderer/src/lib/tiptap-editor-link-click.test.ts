// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { handleTipTapLinkMouse } from '@/lib/tiptap-editor-link-click'

describe('handleTipTapLinkMouse', () => {
  it('öffnet interne Notiz-Verknüpfungen', () => {
    const onOpenNote = vi.fn()
    const a = document.createElement('a')
    a.href = '#chronell-note-42'
    a.textContent = 'Zielnotiz'
    document.body.appendChild(a)

    const ev = new MouseEvent('mousedown', { bubbles: true, button: 0 })
    Object.defineProperty(ev, 'target', { value: a })
    Object.defineProperty(ev, 'composedPath', { value: () => [a, document.body] })

    expect(handleTipTapLinkMouse(ev, onOpenNote)).toBe(true)
    expect(onOpenNote).toHaveBeenCalledWith(42)

    a.remove()
  })

  it('erkennt Wiki-Links über aufgelöste Hash-URL', () => {
    const onOpenNote = vi.fn()
    const a = document.createElement('a')
    a.setAttribute('href', '#chronell-note-7')
    a.href = 'http://localhost:5173/#chronell-note-7'
    document.body.appendChild(a)

    const ev = new MouseEvent('mousedown', { bubbles: true, button: 0 })
    Object.defineProperty(ev, 'composedPath', { value: () => [a] })

    expect(handleTipTapLinkMouse(ev, onOpenNote)).toBe(true)
    expect(onOpenNote).toHaveBeenCalledWith(7)

    a.remove()
  })

  it('ignoriert Klicks ohne Link', () => {
    const p = document.createElement('p')
    p.textContent = 'nur Text'
    document.body.appendChild(p)

    const ev = new MouseEvent('click', { bubbles: true, button: 0 })
    Object.defineProperty(ev, 'composedPath', { value: () => [p] })

    expect(handleTipTapLinkMouse(ev)).toBe(false)

    p.remove()
  })
})
