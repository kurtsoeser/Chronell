import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ComposeSendFromOption, ConnectedAccount, SharedMailboxSendAs } from '@shared/types'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { useAccountsStore } from '@/stores/accounts'
import { showAppAlert, showAppPrompt } from '@/stores/app-dialog'
import { listComposeSendFromOptions } from '@/lib/compose-client'
import { cn } from '@/lib/utils'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function kindLabel(
  kind: ComposeSendFromOption['kind'],
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  switch (kind) {
    case 'primary':
      return t('mail.compose.sendFromKindPrimary', { defaultValue: 'Hauptkonto' })
    case 'alias':
      return t('mail.compose.sendFromKindAlias', { defaultValue: 'Alias' })
    case 'shared':
      return t('mail.compose.sendFromKindShared', { defaultValue: 'Freigegeben' })
  }
}

function optionLabel(o: ComposeSendFromOption): string {
  return o.displayName ? `${o.displayName} — ${o.email}` : o.email
}

function resolveTriggerLabel(
  account: ConnectedAccount,
  effectiveSendFrom: string,
  options: ComposeSendFromOption[]
): string {
  const match = options.find((o) => normalizeEmail(o.email) === normalizeEmail(effectiveSendFrom))
  if (match) return optionLabel(match)
  if (account.displayName) return `${account.displayName} — ${effectiveSendFrom}`
  return effectiveSendFrom
}

interface Props {
  accountId: string
  sendFromEmail: string | null
  onAccountChange: (accountId: string) => void
  onSendFromChange: (email: string | null) => void
  className?: string
}

export function ComposeFromField({
  accountId,
  sendFromEmail,
  onAccountChange,
  onSendFromChange,
  className
}: Props): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const triggerRef = useRef<HTMLButtonElement>(null)

  const [options, setOptions] = useState<ComposeSendFromOption[]>([])
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const reloadOptions = useCallback((): void => {
    if (!accountId) return
    setLoading(true)
    void listComposeSendFromOptions(accountId)
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [accountId])

  useEffect(() => {
    reloadOptions()
  }, [reloadOptions, account?.sharedMailboxSendAs])

  const effectiveSendFrom = useMemo(() => {
    if (!account) return sendFromEmail ?? ''
    if (!sendFromEmail) return account.email
    return sendFromEmail
  }, [account, sendFromEmail])

  const showSendFromPicker =
    account?.provider === 'microsoft' && (options.length > 1 || loading)

  const needsDropdown = accounts.length > 1 || showSendFromPicker

  const closeMenu = useCallback((): void => setMenuOpen(false), [])

  const openMenu = useCallback((): void => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({ x: r.left, y: r.bottom + 4 })
    setMenuOpen(true)
  }, [])

  const addSharedMailbox = useCallback((): void => {
    closeMenu()
    void (async (): Promise<void> => {
      const raw = await showAppPrompt(
        t('mail.compose.addSharedMailboxPrompt', {
          defaultValue: 'SMTP-Adresse des freigegebenen Postfachs:'
        }),
        {
          title: t('mail.compose.addSharedMailboxTitle', {
            defaultValue: 'Freigegebenes Postfach'
          }),
          placeholder: 'team@firma.de'
        }
      )
      if (raw === null) return
      const email = raw.trim()
      if (!email.includes('@')) {
        void showAppAlert(
          t('mail.compose.addSharedMailboxInvalid', {
            defaultValue: 'Bitte eine gueltige E-Mail-Adresse eingeben.'
          }),
          { title: t('mail.compose.addSharedMailboxTitle', { defaultValue: 'Freigegebenes Postfach' }) }
        )
        return
      }
      const existing = account?.sharedMailboxSendAs ?? []
      if (existing.some((e) => normalizeEmail(e.email) === normalizeEmail(email))) {
        onSendFromChange(email)
        reloadOptions()
        return
      }
      const name = await showAppPrompt(
        t('mail.compose.addSharedMailboxNamePrompt', {
          defaultValue: 'Anzeigename (optional):'
        }),
        {
          title: t('mail.compose.addSharedMailboxTitle', { defaultValue: 'Freigegebenes Postfach' }),
          defaultValue: email
        }
      )
      if (name === null) return
      const next: SharedMailboxSendAs[] = [
        ...existing,
        { email, displayName: name.trim() || null }
      ]
      try {
        await window.mailClient.auth.patchAccount({ accountId, sharedMailboxSendAs: next })
        onSendFromChange(email)
        reloadOptions()
      } catch (e) {
        void showAppAlert(e instanceof Error ? e.message : String(e), {
          title: t('mail.compose.addSharedMailboxTitle', { defaultValue: 'Freigegebenes Postfach' })
        })
      }
    })()
  }, [account, accountId, closeMenu, onSendFromChange, reloadOptions, t])

  const menuItems = useMemo((): ContextMenuItem[] => {
    if (!account) return []
    const items: ContextMenuItem[] = []

    if (accounts.length > 1) {
      items.push({
        id: 'accounts',
        label: t('mail.compose.fromMenuAccount', { defaultValue: 'Konto' }),
        submenu: accounts.map((acc) => ({
          id: `acc:${acc.id}`,
          label: acc.displayName ? `${acc.displayName} — ${acc.email}` : acc.email,
          selected: acc.id === accountId,
          onSelect: (): void => {
            onAccountChange(acc.id)
            onSendFromChange(null)
            closeMenu()
          }
        }))
      })
    }

    if (showSendFromPicker) {
      const kinds: ComposeSendFromOption['kind'][] = ['primary', 'alias', 'shared']
      for (const kind of kinds) {
        const group = options.filter((o) => o.kind === kind)
        if (group.length === 0) continue
        items.push({
          id: `kind:${kind}`,
          label: kindLabel(kind, t),
          submenu: group.map((o) => ({
            id: `from:${kind}:${o.email}`,
            label: optionLabel(o),
            selected: normalizeEmail(effectiveSendFrom) === normalizeEmail(o.email),
            onSelect: (): void => {
              onSendFromChange(
                kind === 'primary' &&
                  normalizeEmail(o.email) === normalizeEmail(account.email)
                  ? null
                  : o.email
              )
              closeMenu()
            }
          }))
        })
      }
      if (account.provider === 'microsoft') {
        items.push({ id: 'sep-mailbox', label: '', separator: true })
        items.push({
          id: 'add-shared',
          label: t('mail.compose.addSharedMailboxMenu', {
            defaultValue: 'Freigegebenes Postfach hinzufuegen…'
          }),
          icon: Plus,
          onSelect: addSharedMailbox
        })
      }
    }

    return items
  }, [
    account,
    accountId,
    accounts,
    addSharedMailbox,
    closeMenu,
    effectiveSendFrom,
    onAccountChange,
    onSendFromChange,
    options,
    showSendFromPicker,
    t
  ])

  const triggerLabel = account
    ? resolveTriggerLabel(account, effectiveSendFrom, options)
    : t('mail.compose.noAccount', { defaultValue: '(kein Konto)' })

  if (!account) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <span>{t('mail.composeTile.from', { defaultValue: 'Von' })}:</span>
        <span>{t('mail.compose.noAccount', { defaultValue: '(kein Konto)' })}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2 text-xs',
        className
      )}
    >
      <span className="shrink-0 text-muted-foreground">
        {t('mail.composeTile.from', { defaultValue: 'Von' })}:
      </span>
      {needsDropdown ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            disabled={loading && options.length === 0}
            onClick={(): void => (menuOpen ? closeMenu() : openMenu())}
            className={cn(
              'inline-flex max-w-[min(280px,calc(100vw-12rem))] items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-left text-xs font-medium outline-none transition-colors',
              'hover:bg-secondary/80 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40',
              menuOpen && 'bg-secondary/80'
            )}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={t('mail.compose.sendFromSelectTitle', { defaultValue: 'Absenderadresse' })}
          >
            <span className="min-w-0 truncate">{loading ? '…' : triggerLabel}</span>
            <ChevronDown
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                menuOpen && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
          {menuOpen && menuItems.length > 0 ? (
            <ContextMenu x={menuPos.x} y={menuPos.y} items={menuItems} onClose={closeMenu} />
          ) : null}
        </>
      ) : (
        <span className="max-w-[min(280px,calc(100vw-12rem))] truncate font-medium">
          {triggerLabel}
        </span>
      )}
    </div>
  )
}
