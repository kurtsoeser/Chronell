import { ChevronDown, Info, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

type PermissionItemId = string

interface PermissionGroup {
  id: string
  items: PermissionItemId[]
}

const MICROSOFT_GROUPS: PermissionGroup[] = [
  { id: 'signIn', items: ['offline', 'userRead'] },
  { id: 'mail', items: ['mailReadWrite', 'mailSend', 'mailboxSettings'] },
  { id: 'calendar', items: ['calendars', 'calendarsShared', 'groups'] },
  { id: 'tasks', items: ['tasks'] },
  { id: 'contacts', items: ['contacts', 'people', 'directory'] },
  { id: 'teams', items: ['chat', 'meetings'] },
  { id: 'files', items: ['onedrive', 'sharepoint'] },
  { id: 'bookings', items: ['bookings'] },
  { id: 'ews', items: ['ews'] }
]

const GOOGLE_GROUPS: PermissionGroup[] = [
  { id: 'signIn', items: ['profile'] },
  { id: 'mail', items: ['gmail'] },
  { id: 'calendar', items: ['calendar'] },
  { id: 'tasks', items: ['tasks'] },
  { id: 'contacts', items: ['contacts'] }
]

function ProviderSection({
  provider,
  groups
}: {
  provider: 'microsoft' | 'google'
  groups: PermissionGroup[]
}): JSX.Element {
  const { t } = useTranslation()

  return (
    <details className={cn('group/provider rounded-md border bg-background/50', listSubtleBorderClass)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-secondary/30 marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/provider:rotate-180"
          aria-hidden
        />
        {provider === 'microsoft'
          ? t('settings.accountPermissions.microsoftHeading')
          : t('settings.accountPermissions.googleHeading')}
      </summary>
      <div className="max-h-[min(28vh,16rem)] space-y-3 overflow-y-auto border-t border-border/60 px-3 py-2.5">
        {groups.map((group) => (
          <div key={group.id}>
            <h5 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`settings.accountPermissions.${provider}.groups.${group.id}.title`)}
            </h5>
            <ul className="mt-1.5 space-y-2">
              {group.items.map((itemId) => (
                <li key={itemId} className="text-2xs leading-relaxed">
                  <span className="font-medium text-foreground">
                    {t(`settings.accountPermissions.${provider}.items.${itemId}.label`)}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {t(`settings.accountPermissions.${provider}.items.${itemId}.purpose`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}

export function AccountPermissionsInfoBox(): JSX.Element {
  const { t } = useTranslation()

  return (
    <details
      className={cn(
        'group shrink-0 rounded-md border border-primary/20 bg-primary/5 shadow-sm',
        listSubtleBorderClass
      )}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden"
        aria-label={t('settings.accountPermissions.title')}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Shield className="h-3.5 w-3.5" aria-hidden />
        </div>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-xs font-semibold text-foreground">
            {t('settings.accountPermissions.title')}
          </span>
          <span className="mt-0.5 block text-2xs text-muted-foreground">
            {t('settings.accountPermissions.summaryClosed')}
          </span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="border-t border-primary/15 px-3 pb-3 pt-2">
        <p className="text-2xs leading-relaxed text-muted-foreground">{t('settings.accountPermissions.intro')}</p>

        <ul className="mt-2 space-y-1 text-2xs leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
            <span>{t('settings.accountPermissions.privacyNote')}</span>
          </li>
          <li className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
            <span>{t('settings.accountPermissions.unverifiedNote')}</span>
          </li>
        </ul>

        <div className="mt-3 space-y-2">
          <ProviderSection provider="microsoft" groups={MICROSOFT_GROUPS} />
          <ProviderSection provider="google" groups={GOOGLE_GROUPS} />
        </div>
      </div>
    </details>
  )
}
