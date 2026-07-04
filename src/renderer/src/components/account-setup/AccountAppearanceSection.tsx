import { useTranslation } from 'react-i18next'
import { ExternalLink, ImagePlus, Loader2, UserCircle } from 'lucide-react'
import type { AccountAvatarIconId, AccountAvatarKind } from '@shared/account-avatar'
import type { ConnectedAccount, Provider } from '@shared/types'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import { AccountColorPicker } from '@/components/AccountColorPicker'
import { ACCOUNT_AVATAR_ICON_OPTIONS } from '@/lib/account-avatar-icons'
import { openExternalUrl } from '@/lib/open-external'
import { cn } from '@/lib/utils'

const PROVIDER_ACCOUNT_PORTAL_URL: Record<Provider, string> = {
  microsoft: 'https://myaccount.microsoft.com/',
  google: 'https://myaccount.google.com/',
  demo: 'https://chronell.app/demo/'
}

const AVATAR_KINDS: AccountAvatarKind[] = ['provider', 'initials', 'icon', 'custom']

interface Props {
  account: ConnectedAccount
  displayAvatarDataUrl?: string
  disabled?: boolean
  colorSaving?: boolean
  avatarSaving?: boolean
  onColorChange: (color: string) => void
  onAvatarKindChange: (kind: AccountAvatarKind) => void
  onAvatarIconChange: (iconId: AccountAvatarIconId) => void
  onPickCustomImage: () => void
}

export function AccountAppearanceSection({
  account,
  displayAvatarDataUrl,
  disabled,
  colorSaving,
  avatarSaving,
  onColorChange,
  onAvatarKindChange,
  onAvatarIconChange,
  onPickCustomImage
}: Props): JSX.Element {
  const { t } = useTranslation()
  const kind = account.avatarKind ?? 'provider'

  return (
    <section className="space-y-4 rounded-md border border-border/80 bg-background/60 p-3">
      <div className="flex flex-wrap items-start gap-4">
        <AccountAvatarBadge account={account} imageSrc={displayAvatarDataUrl} size="xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('settings.accountAvatarHeading')}
            </h4>
            <p className="mt-0.5 text-2xs text-muted-foreground">{t('settings.accountAvatarHint')}</p>
          </div>

          <div
            className="flex flex-wrap gap-1 rounded-md bg-background/80 p-0.5"
            role="radiogroup"
            aria-label={t('settings.accountAvatarKindAria')}
          >
            {AVATAR_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                disabled={disabled || avatarSaving}
                onClick={(): void => onAvatarKindChange(k)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-2xs font-medium transition-colors',
                  kind === k
                    ? 'bg-secondary text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                  (disabled || avatarSaving) && 'cursor-not-allowed opacity-40'
                )}
              >
                {t(`settings.accountAvatarKind.${k}`)}
              </button>
            ))}
            {avatarSaving ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin self-center text-muted-foreground" />
            ) : null}
          </div>

          {kind === 'icon' ? (
            <div
              className="grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-1.5 sm:grid-cols-10"
              role="listbox"
              aria-label={t('settings.accountAvatarIconAria')}
            >
              {ACCOUNT_AVATAR_ICON_OPTIONS.map(({ id, Icon }) => {
                const active = account.avatarIconId === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={disabled || avatarSaving}
                    title={id}
                    onClick={(): void => onAvatarIconChange(id)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      (disabled || avatarSaving) && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </button>
                )
              })}
            </div>
          ) : null}

          {kind === 'custom' ? (
            <button
              type="button"
              disabled={disabled || avatarSaving}
              onClick={onPickCustomImage}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-secondary/80 disabled:opacity-40"
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('settings.accountAvatarPickImage')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.accountColorHeading')}
        </h4>
        <p className="mt-0.5 mb-2 text-2xs text-muted-foreground">{t('settings.accountColorHint')}</p>
        <AccountColorPicker
          color={account.color}
          disabled={disabled}
          saving={colorSaving}
          onColorChange={onColorChange}
        />
      </div>

      <div className="border-t border-border/60 pt-2">
        <button
          type="button"
          disabled={disabled}
          onClick={(): void => {
            void openExternalUrl(PROVIDER_ACCOUNT_PORTAL_URL[account.provider]).catch((err) =>
              console.warn('[AccountAppearanceSection] openExternal', err)
            )
          }}
          className="inline-flex h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {account.provider === 'microsoft'
            ? t('settings.accountOnlineMicrosoft')
            : t('settings.accountOnlineGoogle')}
        </button>
        <span className="mx-2 text-border">|</span>
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
          <UserCircle className="h-3 w-3" aria-hidden />
          {t('settings.accountAvatarProviderNote')}
        </span>
      </div>
    </section>
  )
}
