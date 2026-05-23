import { describe, expect, it } from 'vitest'
import { isChromiumZoomShortcutInput, parseZoomShortcutIntent } from './zoom-shortcut-keys'

describe('parseZoomShortcutIntent', () => {
  it('maps Ctrl+Minus to preview zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Minus'
      })
    ).toEqual({ scope: 'preview', action: 'out' })
  })

  it('maps Ctrl+Shift+Minus to ui zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        code: 'Minus'
      })
    ).toEqual({ scope: 'ui', action: 'out' })
  })

  it('maps Ctrl+Shift+Slash (DE minus key) to ui zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        code: 'Slash',
        key: '_'
      })
    ).toEqual({ scope: 'ui', action: 'out' })
  })

  it('maps Ctrl+Slash (DE minus key) to preview zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Slash',
        key: '-'
      })
    ).toEqual({ scope: 'preview', action: 'out' })
  })

  it('maps Ctrl+Shift+Equal to ui zoom in', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        code: 'Equal'
      })
    ).toEqual({ scope: 'ui', action: 'in' })
  })

  it('maps Ctrl+Shift+BracketRight (DE plus key) to ui zoom in', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        code: 'BracketRight',
        key: '+'
      })
    ).toEqual({ scope: 'ui', action: 'in' })
  })
})

describe('isChromiumZoomShortcutInput', () => {
  it('blocks Ctrl+Minus (Chromium page zoom)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: false,
        alt: false,
        key: '-',
        code: 'Minus'
      })
    ).toBe(true)
  })

  it('does not block Ctrl+Shift+Minus (app ui-scale)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: true,
        alt: false,
        key: '_',
        code: 'Minus'
      })
    ).toBe(false)
  })

  it('does not block Ctrl+Slash (DE preview zoom)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: false,
        alt: false,
        key: '-',
        code: 'Slash'
      })
    ).toBe(false)
  })

  it('does not block Ctrl+Shift+Slash (DE ui-scale)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: true,
        alt: false,
        key: '_',
        code: 'Slash'
      })
    ).toBe(false)
  })

  it('does not block Ctrl+Shift+Equal (app ui-scale)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: true,
        alt: false,
        key: '+',
        code: 'Equal'
      })
    ).toBe(false)
  })

  it('does not block Ctrl+Shift+0 (app ui-scale reset)', () => {
    expect(
      isChromiumZoomShortcutInput({
        control: true,
        meta: false,
        shift: true,
        alt: false,
        key: '0',
        code: 'Digit0'
      })
    ).toBe(false)
  })
})
