import type { MailBodyIndexProgress, MailBodyIndexStatus } from '@shared/mail-body-index'

export async function fetchMailBodyIndexStatus(): Promise<MailBodyIndexStatus> {
  return window.mailClient.mailBodyIndex.getStatus()
}

export function subscribeMailBodyIndexProgress(
  onProgress: (progress: MailBodyIndexProgress | null) => void
): () => void {
  return (
    window.mailClient.events?.onMailBodyIndexProgress?.(onProgress) ??
    ((): void => {
      /* preload fehlt */
    })
  )
}
