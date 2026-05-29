import { useAccountsStore } from '@/stores/accounts'
import {
  isAccountProfileAvatarEnabled,
  isContactPhotoAvatarEnabled,
  isGravatarEnabled,
  isSenderDomainAvatarEnabled
} from '@shared/avatar-preferences'
import { combineSenderAvatarImageSrc, profilePhotoSrcForEmail } from '@/lib/contact-avatar'
import { useSenderContactPhoto } from '@/lib/use-sender-contact-photo'

/** Bildquellen fuer Mail-Absender-Avatare gemaess Einstellungen → Kontakte → Avatare. */
export function useSenderAvatarSources(
  email: string | null | undefined,
  accountId?: string | null
): {
  imageSrc: string | undefined
  useGravatar: boolean
  useDomainAvatar: boolean
} {
  const config = useAccountsStore((s) => s.config)
  const accounts = useAccountsStore((s) => s.accounts)
  const profilePhotoDataUrls = useAccountsStore((s) => s.profilePhotoDataUrls)

  const contactPhotoEnabled = isContactPhotoAvatarEnabled(config)
  const contactPhoto = useSenderContactPhoto(email, accountId, contactPhotoEnabled)

  const accountPhoto = isAccountProfileAvatarEnabled(config)
    ? profilePhotoSrcForEmail(accounts, profilePhotoDataUrls, email)
    : undefined

  const imageSrc = combineSenderAvatarImageSrc(accountPhoto, contactPhoto)
  const hasEmail = Boolean(email?.trim())

  return {
    imageSrc,
    useGravatar: hasEmail && isGravatarEnabled(config),
    useDomainAvatar: hasEmail && isSenderDomainAvatarEnabled(config)
  }
}
