import { describe, expect, it, vi } from 'vitest'
import { withNoteSaveRetry } from './note-save-with-retry'

describe('withNoteSaveRetry', () => {
  it('gibt beim ersten Erfolg zurück', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withNoteSaveRetry(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('wiederholt bis zu 3 Mal bei Fehlern', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipc fail'))
      .mockRejectedValueOnce(new Error('ipc fail'))
      .mockResolvedValue('saved')

    await expect(withNoteSaveRetry(fn, { retryDelayMs: 0 })).resolves.toBe('saved')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('wirft nach allen Versuchen den letzten Fehler', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'))
    await expect(withNoteSaveRetry(fn, { maxAttempts: 2, retryDelayMs: 0 })).rejects.toThrow(
      'persistent'
    )
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
