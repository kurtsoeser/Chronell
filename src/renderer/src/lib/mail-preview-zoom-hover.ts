/** Shadow-Host der Mail-/Kalender-Vorschau, über dem die Maus liegt (für Strg+Plus/Minus). */
let hoveredHost: HTMLElement | null = null

export function getHoveredMailPreviewZoomHost(): HTMLElement | null {
  return hoveredHost
}

export function bindMailPreviewZoomHover(host: HTMLElement): () => void {
  const onEnter = (): void => {
    hoveredHost = host
  }
  const onLeave = (): void => {
    if (hoveredHost === host) hoveredHost = null
  }
  host.addEventListener('mouseenter', onEnter)
  host.addEventListener('mouseleave', onLeave)
  return (): void => {
    host.removeEventListener('mouseenter', onEnter)
    host.removeEventListener('mouseleave', onLeave)
    if (hoveredHost === host) hoveredHost = null
  }
}
