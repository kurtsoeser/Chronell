import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, Loader2, Sparkles } from 'lucide-react'
import type { CalendarMeetingAiInsightsResult } from '@shared/types'
import { cn } from '@/lib/utils'
import { PreviewFoldSection } from '@/components/PreviewFoldSection'

export interface CalendarMeetingInsightsPanelProps {
  accountId: string
  joinUrl: string | null
  /** Vom Parent geladene Insights (ein Fetch für UI + Copilot-Kontext). */
  result: CalendarMeetingAiInsightsResult | null
  loading: boolean
  className?: string
}

export function CalendarMeetingInsightsPanel({
  accountId,
  joinUrl,
  result,
  loading,
  className
}: CalendarMeetingInsightsPanelProps): JSX.Element | null {
  const { t } = useTranslation()
  /** Smart Default: zu, außer Status ok (dann auf). */
  const [expanded, setExpanded] = useState(false)
  const [userToggled, setUserToggled] = useState(false)

  useEffect(() => {
    setUserToggled(false)
    setExpanded(false)
  }, [accountId, joinUrl])

  useEffect(() => {
    if (userToggled) return
    if (result?.status === 'ok') {
      setExpanded(true)
      return
    }
    if (!loading) setExpanded(false)
  }, [loading, result?.insightId, result?.status, userToggled])

  const canShow = accountId.startsWith('ms:') && !!joinUrl?.trim()
  if (!canShow) return null

  const hideQuietStatuses =
    !loading &&
    result &&
    (result.status === 'notEnded' ||
      result.status === 'noJoinUrl' ||
      result.status === 'unsupported' ||
      result.status === 'meetingNotFound')

  if (hideQuietStatuses) return null

  const showOk = result?.status === 'ok'
  const showPending = result?.status === 'pending'
  const showForbidden = result?.status === 'forbidden'
  const showError = result?.status === 'error'

  return (
    <PreviewFoldSection
      icon={Sparkles}
      title={t('calendar.meetingInsights.title')}
      expanded={expanded}
      onToggle={(): void => {
        setUserToggled(true)
        setExpanded((v) => !v)
      }}
      iconClassName="text-primary"
      trailing={
        loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : null
      }
      summary={
        showOk
          ? t('calendar.meetingInsights.summaryOk', {
              notes: result?.meetingNotes.length ?? 0,
              actions: result?.actionItems.length ?? 0
            })
          : showPending
            ? t('calendar.meetingInsights.pendingShort')
            : loading
              ? t('calendar.meetingInsights.loading')
              : undefined
      }
      className={cn('min-h-0', className)}
      contentClassName="space-y-3 text-sm"
    >
      {loading && !result ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('calendar.meetingInsights.loading')}
        </p>
      ) : null}

      {showPending ? (
        <p className="text-xs text-muted-foreground">{t('calendar.meetingInsights.pending')}</p>
      ) : null}

      {showForbidden ? (
        <p className="text-xs text-destructive" role="alert">
          {t('calendar.meetingInsights.forbidden')}
          {result?.errorMessage ? (
            <span className="mt-1 block text-muted-foreground">{result.errorMessage}</span>
          ) : null}
        </p>
      ) : null}

      {showError ? (
        <p className="text-xs text-destructive" role="alert">
          {t('calendar.meetingInsights.error')}
          {result?.errorMessage ? (
            <span className="mt-1 block text-muted-foreground">{result.errorMessage}</span>
          ) : null}
        </p>
      ) : null}

      {showOk && result ? (
        <>
          {result.meetingNotes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                {t('calendar.meetingInsights.notesHeading')}
              </p>
              <ul className="space-y-2">
                {result.meetingNotes.map((note, i) => (
                  <li
                    key={`note-${i}-${note.title ?? ''}`}
                    className="rounded-md border border-border/50 bg-secondary/[0.04] px-2.5 py-2"
                  >
                    {note.title ? (
                      <p className="text-xs font-semibold text-foreground">{note.title}</p>
                    ) : null}
                    {note.text ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                        {note.text}
                      </p>
                    ) : null}
                    {note.subpoints.length > 0 ? (
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        {note.subpoints.map((sp, j) => (
                          <li key={`sp-${i}-${j}`}>
                            {sp.title ? (
                              <span className="font-medium text-foreground">{sp.title}: </span>
                            ) : null}
                            {sp.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.actionItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                {t('calendar.meetingInsights.actionsHeading')}
              </p>
              <ul className="space-y-1.5">
                {result.actionItems.map((item, i) => (
                  <li
                    key={`action-${i}-${item.title ?? ''}`}
                    className="flex gap-2 rounded-md border border-border/50 bg-secondary/[0.04] px-2.5 py-2"
                  >
                    <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      {item.title ? (
                        <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      ) : null}
                      {item.text ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                          {item.text}
                        </p>
                      ) : null}
                      {item.ownerDisplayName ? (
                        <p className="mt-1 text-2xs text-muted-foreground">
                          {t('calendar.meetingInsights.owner', { name: item.ownerDisplayName })}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.mentionCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('calendar.meetingInsights.mentions', { count: result.mentionCount })}
            </p>
          ) : null}
        </>
      ) : null}
    </PreviewFoldSection>
  )
}
