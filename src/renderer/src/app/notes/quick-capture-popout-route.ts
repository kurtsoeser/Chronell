export function isQuickCapturePopoutWindow(): boolean {
  const hash = window.location.hash.replace(/^#/, '')
  return hash.startsWith('quick-capture-popout')
}
