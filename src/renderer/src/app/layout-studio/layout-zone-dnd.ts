/** MIME-Typ für Zonen-Drag (Panel zwischen Plätzen tauschen). */
export const LAYOUT_ZONE_LEAF_DND_MIME = 'application/x-mailclient-layout-zone-leaf'

export function readLayoutZoneLeafDragId(dataTransfer: DataTransfer): string | null {
  const raw = dataTransfer.getData(LAYOUT_ZONE_LEAF_DND_MIME).trim()
  return raw || null
}

export function hasLayoutZoneLeafDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(LAYOUT_ZONE_LEAF_DND_MIME)
}
