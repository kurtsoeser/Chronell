import { UserCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AvatarPreferencesPatch } from '@shared/avatar-preferences'
import { useAccountsStore } from '@/stores/accounts'

function AvatarPreferenceToggle({
  title,
  hint,
  checked,
  disabled,
  onChange
}: {
  title: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md bg-background/60 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e): void => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
      />
      <span className="flex-1 text-xs">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block leading-relaxed text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

export function SettingsContactsAvatarsSection({ busy }: { busy: boolean }): JSX.Element {
  const { t } = useTranslation()
  const config = useAccountsStore((s) => s.config)
  const setAvatarPreferences = useAccountsStore((s) => s.setAvatarPreferences)

  async function patch(partial: Partial<AvatarPreferencesPatch>): Promise<void> {
    await setAvatarPreferences(partial)
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <UserCircle2 className="h-3.5 w-3.5" aria-hidden />
        {t('settings.contactsAvatarsHeading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.contactsAvatarsIntro')}</p>
      <p className="text-2xs leading-relaxed text-muted-foreground">{t('settings.contactsAvatarsPriorityHint')}</p>
      <div className="space-y-2">
        <AvatarPreferenceToggle
          title={t('settings.avatarPrefAccountProfileTitle')}
          hint={t('settings.avatarPrefAccountProfileHint')}
          checked={config?.accountProfileAvatarEnabled !== false}
          disabled={busy}
          onChange={(value): void => {
            void patch({ accountProfileAvatarEnabled: value })
          }}
        />
        <AvatarPreferenceToggle
          title={t('settings.avatarPrefContactPhotoTitle')}
          hint={t('settings.avatarPrefContactPhotoHint')}
          checked={config?.contactPhotoAvatarEnabled !== false}
          disabled={busy}
          onChange={(value): void => {
            void patch({ contactPhotoAvatarEnabled: value })
          }}
        />
        <AvatarPreferenceToggle
          title={t('settings.avatarPrefGravatarTitle')}
          hint={t('settings.avatarPrefGravatarHint')}
          checked={config?.gravatarEnabled === true}
          disabled={busy}
          onChange={(value): void => {
            void patch({ gravatarEnabled: value })
          }}
        />
        <AvatarPreferenceToggle
          title={t('settings.avatarPrefDomainTitle')}
          hint={t('settings.avatarPrefDomainHint')}
          checked={config?.senderDomainAvatarEnabled !== false}
          disabled={busy}
          onChange={(value): void => {
            void patch({ senderDomainAvatarEnabled: value })
          }}
        />
      </div>
      <p className="text-2xs leading-relaxed text-muted-foreground">{t('settings.contactsAvatarsFallbackHint')}</p>
    </section>
  )
}
