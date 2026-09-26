export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = (): void => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

/** Vollstaendige Data-URI (`data:image/…;base64,…`). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(String(reader.result ?? ''))
    reader.onerror = (): void => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}
