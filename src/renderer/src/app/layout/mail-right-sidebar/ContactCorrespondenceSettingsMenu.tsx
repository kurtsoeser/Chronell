import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'
import {
  type ContactCorrespondenceSettings,
  persistContactCorrespondenceSettings
} from '@/app/layout/mail-right-sidebar/contact-correspondence-settings'
import { cn } from '@/lib/utils'

interface Props {
  settings: ContactCorrespondenceSettings
  onChange: (next: ContactCorrespondenceSettings) => void
  hasContactAliases: boolean
}

export function ContactCorrespondenceSettingsMenu({
  settings,
  onChange,
  hasContactAliases
}: Props): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground',
          'hover:bg-secondary hover:text-foreground',
          open && 'bg-secondary text-foreground'
        )}
        title={t('mail.rightSidebar.contactSettingsTitle')}
        aria-expanded={open}
        onClick={(): void => setOpen((v) => !v)}
      >
        <Settings2 className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] cursor-default"
            aria-label={t('common.close')}
            onClick={(): void => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-[100] mt-1 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
            role="dialog"
            aria-label={t('mail.rightSidebar.contactSettingsTitle')}
          >
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('mail.rightSidebar.contactSettingsTitle')}
            </p>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-secondary/50">
              <input
                type="radio"
                name="contact-account-scope"
                className="mt-0.5"
                checked={settings.accountScope === 'current_account'}
                onChange={(): void => {
                  onChange(
                    persistContactCorrespondenceSettings({ accountScope: 'current_account' })
                  )
                }}
              />
              <span className="text-[11px] leading-snug text-foreground">
                {t('mail.rightSidebar.contactSettingsCurrentAccount')}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-secondary/50">
              <input
                type="radio"
                name="contact-account-scope"
                className="mt-0.5"
                checked={settings.accountScope === 'all_accounts'}
                onChange={(): void => {
                  onChange(
                    persistContactCorrespondenceSettings({ accountScope: 'all_accounts' })
                  )
                }}
              />
              <span className="text-[11px] leading-snug text-foreground">
                {t('mail.rightSidebar.contactSettingsAllAccounts')}
              </span>
            </label>
            <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-secondary/50">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.includeDeletedJunk}
                onChange={(e): void => {
                  onChange(
                    persistContactCorrespondenceSettings({
                      includeDeletedJunk: e.target.checked
                    })
                  )
                }}
              />
              <span className="text-[11px] leading-snug text-foreground">
                {t('mail.rightSidebar.contactSettingsIncludeTrash')}
              </span>
            </label>
            {hasContactAliases ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-secondary/50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.includeContactAliases}
                  onChange={(e): void => {
                    onChange(
                      persistContactCorrespondenceSettings({
                        includeContactAliases: e.target.checked
                      })
                    )
                  }}
                />
                <span className="text-[11px] leading-snug text-foreground">
                  {t('mail.rightSidebar.contactSettingsAliases')}
                </span>
              </label>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
