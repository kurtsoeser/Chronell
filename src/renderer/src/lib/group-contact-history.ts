import type { MailCorrespondenceItem } from '@shared/types'
import {
  contactHistoryDateBucket,
  type ContactHistoryDateBucketLabels
} from '@/lib/contact-history-date-bucket'

export interface ContactHistoryGroup {
  key: string
  label: string
  sortOrder: number
  items: MailCorrespondenceItem[]
}

export function groupContactHistoryItems(
  items: MailCorrespondenceItem[],
  bucketLabels: ContactHistoryDateBucketLabels,
  locale: string
): ContactHistoryGroup[] {
  const buckets = new Map<string, ContactHistoryGroup>()
  for (const item of items) {
    const iso = item.receivedAt ?? item.sentAt
    const { key, label, sortOrder } = contactHistoryDateBucket(iso, bucketLabels, locale)
    const existing = buckets.get(key)
    if (existing) {
      existing.items.push(item)
    } else {
      buckets.set(key, { key, label, sortOrder, items: [item] })
    }
  }
  return [...buckets.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}
