import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  Briefcase,
  Building2,
  Calendar,
  Cloud,
  Database,
  Folder,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Home,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  School,
  Send,
  Server,
  Shield,
  Star,
  User,
  Users,
  Zap
} from 'lucide-react'
import { ACCOUNT_AVATAR_ICON_IDS, type AccountAvatarIconId } from '@shared/account-avatar'

const ICON_BY_ID: Record<AccountAvatarIconId, LucideIcon> = {
  mail: Mail,
  inbox: Inbox,
  'building-2': Building2,
  briefcase: Briefcase,
  user: User,
  users: Users,
  home: Home,
  school: School,
  'graduation-cap': GraduationCap,
  heart: Heart,
  star: Star,
  zap: Zap,
  globe: Globe,
  cloud: Cloud,
  server: Server,
  database: Database,
  folder: Folder,
  calendar: Calendar,
  phone: Phone,
  'message-circle': MessageCircle,
  send: Send,
  'at-sign': AtSign,
  hash: Hash,
  shield: Shield
}

export function resolveAccountAvatarIcon(iconId: string | null | undefined): LucideIcon | null {
  const id = iconId?.trim()
  if (!id || !(ACCOUNT_AVATAR_ICON_IDS as readonly string[]).includes(id)) return null
  return ICON_BY_ID[id as AccountAvatarIconId] ?? null
}

export const ACCOUNT_AVATAR_ICON_OPTIONS = ACCOUNT_AVATAR_ICON_IDS.map((id) => ({
  id,
  Icon: ICON_BY_ID[id]
}))
