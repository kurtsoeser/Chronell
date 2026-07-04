import type { ConnectedAccount } from '@shared/types'
import {
  DEMO_ACCOUNT_GOOGLE_EMAIL,
  DEMO_ACCOUNT_GOOGLE_ID,
  DEMO_ACCOUNT_M365_EMAIL,
  DEMO_ACCOUNT_M365_ID
} from '@shared/demo'

export const DEMO_SCENARIO_ID = 'nordlicht-consulting' as const

export function buildDemoAccounts(): ConnectedAccount[] {
  const now = '2026-07-03T10:00:00.000Z'
  return [
    {
      id: DEMO_ACCOUNT_M365_ID,
      provider: 'demo',
      email: DEMO_ACCOUNT_M365_EMAIL,
      displayName: 'Anna Weber',
      color: 'bg-blue-500',
      initials: 'AW',
      addedAt: now,
      isDemo: true,
      avatarKind: 'initials',
      bookWithMeUrl: 'https://outlook.office.com/book/nordlicht-demo@nordlicht-demo.local/',
      calendarLoadAheadDays: 365
    },
    {
      id: DEMO_ACCOUNT_GOOGLE_ID,
      provider: 'demo',
      email: DEMO_ACCOUNT_GOOGLE_EMAIL,
      displayName: 'Projekt Alpha',
      color: 'bg-emerald-500',
      initials: 'PA',
      addedAt: now,
      isDemo: true,
      avatarKind: 'icon',
      avatarIconId: 'folder',
      calendarLoadAheadDays: 365
    }
  ]
}
