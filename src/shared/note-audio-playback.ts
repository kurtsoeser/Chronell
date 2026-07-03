export function readAudioElementDuration(audio: HTMLAudioElement): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  if (audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1)
    if (Number.isFinite(end) && end > 0) return end
  }
  return 0
}

export function mergeAudioDurationKnown(current: number, ...candidates: number[]): number {
  const valid = candidates.filter((value) => Number.isFinite(value) && value > 0)
  if (valid.length === 0) return current
  return Math.max(current, ...valid)
}

export async function probeAudioUrlDuration(url: string, signal?: AbortSignal): Promise<number> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0))
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) return 0
    return decoded.duration
  } finally {
    await ctx.close()
  }
}
