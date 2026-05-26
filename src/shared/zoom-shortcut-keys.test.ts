import { describe, expect, it } from 'vitest'
import { isAppZoomShortcutInput, isChromiumZoomShortcutInput, parseZoomShortcutIntent } from './zoom-shortcut-keys'

describe('parseZoomShortcutIntent', () => {
  it('maps Ctrl+Minus to ui zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Minus'
      })
    ).toEqual({ scope: 'ui', action: 'out' })
  })

  it('maps Ctrl+Shift+Minus to ui zoom out (DE plus key often needs shift)', () => {
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

  it('maps Ctrl+Slash (DE minus key) to ui zoom out', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Slash',
        key: '-'
      })
    ).toEqual({ scope: 'ui', action: 'out' })
  })

  it('maps Ctrl+Equal to ui zoom in', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
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

  it('maps Ctrl+0 to ui zoom reset', () => {
    expect(
      parseZoomShortcutIntent({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        code: 'Digit0'
      })
    ).toEqual({ scope: 'ui', action: 'reset' })
  })
})

describe('isAppZoomShortcutInput', () => {
  it('blocks Ctrl+Minus (Chromium page zoom)', () => {
    expect(
      isAppZoomShortcutInput({
        control: true,
        meta: false,
        shift: false,
        alt: false,
        key: '-',
        code: 'Minus'
      })
    ).toBe(true)
  })

  it('blocks Ctrl+Slash (DE minus)', () => {
    expect(
      isAppZoomShortcutInput({
        control: true,
        meta: false,
        shift: false,
        alt: false,
        key: '-',
        code: 'Slash'
      })
    ).toBe(true)
  })

  it('blocks Ctrl+Shift+BracketRight (DE plus)', () => {
    expect(
      isAppZoomShortcutInput({
        control: true,
        meta: false,
        shift: true,
        alt: false,
        key: '+',
        code: 'BracketRight'
      })
    ).toBe(true)
  })

  it('isChromiumZoomShortcutInput delegates to isAppZoomShortcutInput', () => {
    const input = {
      control: true,
      meta: false,
      shift: true,
      alt: false,
      key: '+',
      code: 'BracketRight'
    }
    expect(isChromiumZoomShortcutInput(input)).toBe(isAppZoomShortcutInput(input))
  })
})
