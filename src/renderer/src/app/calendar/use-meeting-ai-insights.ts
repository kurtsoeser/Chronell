import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarMeetingAiInsightsResult } from '@shared/types'

export function useMeetingAiInsights(input: {
  accountId: string
  joinUrl: string | null
  endIso: string
}): {
  loading: boolean
  result: CalendarMeetingAiInsightsResult | null
} {
  const { t } = useTranslation()
  const { accountId, joinUrl, endIso } = input
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CalendarMeetingAiInsightsResult | null>(null)

  const canFetch = accountId.startsWith('ms:') && !!joinUrl?.trim()

  useEffect(() => {
    if (!canFetch || !joinUrl?.trim()) {
      setResult(null)
      setLoading(false)
      return
    }

    const getInsights = window.mailClient?.calendar?.getMeetingAiInsights
    if (typeof getInsights !== 'function') {
      setLoading(false)
      setResult({
        status: 'error',
        meetingId: null,
        insightId: null,
        createdDateTime: null,
        endDateTime: null,
        meetingNotes: [],
        actionItems: [],
        mentionCount: 0,
        mentionSnippets: [],
        errorMessage: t('calendar.meetingInsights.preloadStale')
      })
      return
    }

    let cancelled = false
    setLoading(true)
    setResult(null)

    void getInsights({
      accountId,
      joinUrl,
      endIso
    })
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch((e) => {
        if (!cancelled) {
          setResult({
            status: 'error',
            meetingId: null,
            insightId: null,
            createdDateTime: null,
            endDateTime: null,
            meetingNotes: [],
            actionItems: [],
            mentionCount: 0,
            mentionSnippets: [],
            errorMessage: e instanceof Error ? e.message : String(e)
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return (): void => {
      cancelled = true
    }
  }, [accountId, canFetch, endIso, joinUrl, t])

  return { loading, result }
}
