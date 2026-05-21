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

function sendFromMenuLabel(o: ComposeSendFromOption, t: (key: string, o?: { defaultValue?: string }) => string): string {
  return `${kindLabel(o.kind, t)} · ${optionLabel(o)}`
}

function primaryFallback(acc: ConnectedAccount): ComposeSendFromOption {
  return { email: acc.email, displayName: acc.displayName, kind: 'primary' }
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

function accountHasSendChoices(acc: ConnectedAccount, options: ComposeSendFromOption[]): boolean {
  return acc.provider === 'microsoft' && options.length > 1
}

interface Props {
  accountId: string
  sendFromEmail: string | null
  onAccountChange: (accountId: string) => void
  onSendFromChange: (email: string | null) => void
  /** In der Aktionszeile neben «Senden» (eine Zeile weniger). */
  variant?: 'bar' | 'inline'
  className?: string
}

export function ComposeFromField({
  accountId,
  sendFromEmail,
  onAccountChange,
  onSendFromChange,
  variant = 'bar',
  className
}: Props): JSX.Element {
  const inline = variant === 'inline'
  const triggerMaxW = inline
    ? 'max-w-[min(240px,38vw)]'
    : 'max-w-[min(280px,calc(100vw-12rem))]'
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const triggerRef = useRef<HTMLButtonElement>(null)

  const [optionsByAccountId, setOptionsByAccountId] = useState<Record<string, ComposeSendFromOption[]>>({})
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const options = account ? (optionsByAccountId[account.id] ?? []) : []

  const reloadOptionsForAccount = useCallback(async (id: string): Promise<void> => {
    const acc = accounts.find((a) => a.id === id)
    if (!acc) return
    try {
      const list = await listComposeSendFromOptions(id)
      setOptionsByAccountId((prev) => ({
        ...prev,
        [id]: list.length > 0 ? list : [primaryFallback(acc)]
      }))
    } catch {
      setOptionsByAccountId((prev) => ({ ...prev, [id]: [primaryFallback(acc)] }))
    }
  }, [accounts])

  const reloadAllOptions = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      await Promise.all(accounts.map((a) => reloadOptionsForAccount(a.id)))
    } finally {
      setLoading(false)
    }
  }, [accounts, reloadOptionsForAccount])

  useEffect(() => {
    if (!accountId) return
    void reloadOptionsForAccount(accountId)
  }, [accountId, account?.sharedMailboxSendAs, reloadOptionsForAccount])

  useEffect(() => {
    if (menuOpen) void reloadAllOptions()
  }, [menuOpen, reloadAllOptions])

  const effectiveSendFrom = useMemo(() => {
    if (!account) return sendFromEmail ?? ''
    if (!sendFromEmail) return account.email
    return sendFromEmail
  }, [account, sendFromEmail])

  const needsDropdown = useMemo(() => {
    if (accounts.length > 1) return true
    if (!account) return false
    const accOpts = optionsByAccountId[account.id] ?? []
    return accountHasSendChoices(account, accOpts) || loading
  }, [account, accounts.length, loading, optionsByAccountId])

  const closeMenu = useCallback((): void => setMenuOpen(false), [])

  const openMenu = useCallback((): void => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({ x: r.left, y: r.bottom + 4 })
    setMenuOpen(true)
  }, [])

  const selectSendFrom = useCallback(
    (targetAccountId: string, opt: ComposeSendFromOption): void => {
      const acc = accounts.find((a) => a.id === targetAccountId)
      if (!acc) return
      if (targetAccountId !== accountId) onAccountChange(targetAccountId)
      const isPrimary =
        opt.kind === 'primary' && normalizeEmail(opt.email) === normalizeEmail(acc.email)
      onSendFromChange(isPrimary ? null : opt.email)
      closeMenu()
    },
    [accountId, accounts, closeMenu, onAccountChange, onSendFromChange]
  )

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
        void reloadOptionsForAccount(accountId)
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
        void reloadOptionsForAccount(accountId)
      } catch (e) {
        void showAppAlert(e instanceof Error ? e.message : String(e), {
          title: t('mail.compose.addSharedMailboxTitle', { defaultValue: 'Freigegebenes Postfach' })
        })
      }
    })()
  }, [account, accountId, closeMenu, onSendFromChange, reloadOptionsForAccount, t])

  const menuItems = useMemo((): ContextMenuItem[] => {
    if (!account || accounts.length === 0) return []

    const kindOrder: ComposeSendFromOption['kind'][] = ['primary', 'alias', 'shared']
    const items: ContextMenuItem[] = accounts.map((acc) => {
      const accOpts = optionsByAccountId[acc.id] ?? [primaryFallback(acc)]
      const sorted = [...accOpts].sort(
        (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)
      )
      const accLabel = acc.displayName ? `${acc.displayName} — ${acc.email}` : acc.email
      const isCurrentAccount = acc.id === accountId

      return {
        id: `acc:${acc.id}`,
        label: accLabel,
        selected: isCurrentAccount,
        submenu: sorted.map((o) => ({
          id: `from:${acc.id}:${o.kind}:${o.email}`,
          label: sendFromMenuLabel(o, t),
          selected:
            isCurrentAccount &&
            normalizeEmail(effectiveSendFrom) === normalizeEmail(o.email),
          onSelect: (): void => selectSendFrom(acc.id, o)
        }))
      }
    })

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

    return items
  }, [
    account,
    accountId,
    accounts,
    addSharedMailbox,
    effectiveSendFrom,
    optionsByAccountId,
    selectSendFrom,
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
        inline
          ? 'flex min-w-0 items-center gap-1.5 text-xs'
          : 'flex shrink-0 items-center gap-2 px-3 py-2 text-xs',
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
            disabled={loading && Object.keys(optionsByAccountId).length === 0}
            onClick={(): void => (menuOpen ? closeMenu() : openMenu())}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-left text-xs font-medium outline-none transition-colors',
              triggerMaxW,
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
        <span className={cn(triggerMaxW, 'truncate font-medium')}>
          {triggerLabel}
        </span>
      )}
    </div>
  )
}
