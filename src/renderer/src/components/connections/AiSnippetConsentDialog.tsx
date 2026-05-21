import { useTranslation } from 'react-i18next'
import type { EntityLinkAiPayloadPreview } from '@shared/entity-link-ai-payload'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

export function AiSnippetConsentDialog({
  preview,
  busy = false,
  showSkipSession = true,
  skipSession,
  onSkipSessionChange,
  onConfirmWithExcerpt,
  onConfirmMetadataOnly,
  onCancel
}: {
  preview: EntityLinkAiPayloadPreview | null
  busy?: boolean
  showSkipSession?: boolean
  skipSession?: boolean
  onSkipSessionChange?: (v: boolean) => void
  onConfirmWithExcerpt: () => void
  onConfirmMetadataOnly: () => void
  onCancel: () => void
}): JSX.Element {
  const { t } = useTranslation()

  const excerptSourceKey =
    preview?.excerptSource && preview.excerptSource !== 'none'
      ? `connections.aiPayload.excerptSource.${preview.excerptSource}`
      : null

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2',
        busy && 'pointer-events-none opacity-60'
      )}
    >
      <p className="text-xs font-medium text-foreground">
        {t('connections.aiPayload.consentTitle')}
      </p>
      <p className="text-[11px] text-muted-foreground whitespace-pre-line">
        {t('connections.aiPayload.consentHint')}
      </p>
      {preview ? (
        <div className="max-h-40 overflow-y-auto rounded-md bg-muted/25 p-2 text-[10px]">
          <p className="font-medium text-foreground">{preview.anchorTitle}</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {preview.metadataFields.slice(0, 8).map((f) => (
              <li key={f.key}>
                <span className="text-foreground/80">{f.label}:</span> {f.value}
              </li>
            ))}
          </ul>
          {preview.excerpt ? (
            <p className={cn('mt-2 border-t pt-2 text-foreground', listSubtleBorderClass)}>
              {excerptSourceKey ? (
                <span className="block text-[9px] text-muted-foreground">
                  {t(excerptSourceKey)}
                </span>
              ) : null}
              <span className="line-clamp-4">{preview.excerpt}</span>
              <span className="mt-0.5 block text-[9px] text-muted-foreground">
                {t('connections.aiPayload.excerptChars', { count: preview.excerptCharCount })}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[9px] text-muted-foreground">
              {t('connections.aiPayload.noExcerpt')}
            </p>
          )}
          <p className="mt-1 text-[9px] text-muted-foreground">
            {t('connections.aiPayload.totalEstimate', { count: preview.totalCharEstimate })}
          </p>
        </div>
      ) : null}
      <p className="text-[10px] text-muted-foreground">{t('connections.aiPayload.neverSent')}</p>
      {showSkipSession && onSkipSessionChange ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={skipSession ?? false}
            onChange={(e): void => onSkipSessionChange(e.target.checked)}
          />
          <span className="text-[10px] text-foreground">
            {t('connections.aiPayload.skipAskSession')}
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirmMetadataOnly}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
        >
          {t('connections.aiPayload.confirmMetadataOnly')}
        </button>
        <button
          type="button"
          disabled={busy || !preview?.excerpt}
          onClick={onConfirmWithExcerpt}
          className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
        >
          {t('connections.aiPayload.confirmWithExcerpt')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-md border border-border px-2 py-1 text-[11px]"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
