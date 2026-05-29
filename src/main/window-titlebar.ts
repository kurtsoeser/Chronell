import type { BrowserWindowConstructorOptions } from 'electron'

/** Nur Windows: eigenes Titelleisten-Chrome im Renderer (frameless). */
export function isWin32FramelessTitleBar(): boolean {
  return process.platform === 'win32'
}

export function mainWindowTitleBarOptions(): Pick<BrowserWindowConstructorOptions, 'frame'> {
  if (!isWin32FramelessTitleBar()) return {}
  return { frame: false }
}
