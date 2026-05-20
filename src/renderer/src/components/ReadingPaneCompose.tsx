import { useCallback, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Paperclip,
  Save,
  Send,
  SquareArrowOutUpRight,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TipTapBody } from '@/components/TipTapBody'
import { SignatureTemplateControls } from '@/components/SignatureTemplateControls'
import { RecipientTokenField } from '@/components/RecipientTokenField'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format-bytes'
import { useAccountsStore } from '@/stores/accounts'
import {
  useComposeStore,
  type ComposeAttachmentFile,
  type ComposeDraft
} from '@/stores/compose'
import { useComposeAutoSave } from '@/hooks/useComposeAutoSave'

const MAX_ATTACHMENTS_TOTAL_BYTES = 24 * 1024 * 1024

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function ReadingPaneCompose({
  draft,
  onPopOut,
  onClose
}: {
  draft: ComposeDraft
  onPopOut: () => void
  onClose: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const update = useComposeStore((s) => s.update)
  const send = useComposeStore((s) => s.send)
  const saveRemoteDraft = useComposeStore((s) => s.saveRemoteDraft)
  const addAttachments = useComposeStore((s) => s.addAttachments)
  const removeAttachment = useComposeStore((s) => s.removeAttachment)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [showQuoted, setShowQuoted] = useState(false)

  useComposeAutoSave(draft.id, true)

  const account = accounts.find((a) => a.id === draft.accountId) ?? accounts[0]
  const attachmentsTotal = draft.attachments.reduce((s, a) => s + a.size, 0)
  const isDraftEdit = draft.linkedMessageId != null && draft.savedRemoteDraftId != null
  const composeModeLabel =
    draft.mode === 'forward'
      ? t('mail.readingPane.composingForward', { defaultValue: 'Weiterleitung verfassen' })
      : draft.mode === 'reply' || draft.mode === 'replyAll'
        ? t('mail.readingPane.composingReply', { defaultValue: 'Antwort verfassen' })
        : isDraftEdit
          ? t('mail.readingPane.editingDraft', { defaultValue: 'Entwurf bearbeiten' })
          : t('mail.readingPane.composingNew', { defaultValue: 'Neue E-Mail' })

  const addFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return
      setAttachmentError(null)
      try {
        const next: ComposeAttachmentFile[] = []
        let running = attachmentsTotal
        for (const f of files) {
          if (running + f.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
            setAttachmentError(
              t('mail.composeTile.attachmentMax', {
                maxMb: MAX_ATTACHMENTS_TOTAL_BYTES / (1024 * 1024),
                file: f.name
              })
            )
            continue
          }
          const buf = await f.arrayBuffer()
          next.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: f.name,
            size: f.size,
            contentType: f.type || 'application/octet-stream',
            dataBase64: arrayBufferToBase64(buf)
          })
          running += f.size
        }
        if (next.length > 0) addAttachments(draft.id, next)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setAttachmentError(msg)
      }
    },
    [addAttachments, attachmentsTotal, draft.id, t]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          disabled={draft.busy}
          title={t('mail.composeTile.saveDraft')}
          onClick={(): void => void saveRemoteDraft(draft.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary',
            draft.busy && 'pointer-events-none opacity-50'
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {t('mail.composeTile.saveDraft')}
        </button>
        <button
          type="button"
          disabled={draft.busy}
          onClick={(): void => void send(draft.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
            draft.busy
              ? 'bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {draft.busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {t('mail.composeTile.send')}
        </button>
        <button
          type="button"
          title={t('mail.readingPane.composePopOutTitle')}
          onClick={onPopOut}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <SquareArrowOutUpRight className="h-3.5 w-3.5" />
          {t('mail.readingPane.composePopOut')}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title={t('mail.readingPane.composeCloseTitle')}
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('mail.readingPane.composeCloseTitle')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 border-b border-border/60 px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">{t('mail.composeTile.from')} </span>
        {accounts.length > 1 ? (
          <select
            value={draft.accountId}
            onChange={(e): void =>
              update(draft.id, { accountId: e.target.value, savedRemoteDraftId: undefined })
            }
            className="max-w-full rounded border border-border bg-background px-2 py-0.5 text-xs"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} ({a.email})
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium">{account?.email ?? '—'}</span>
        )}
        <span className="ml-2 text-[10px] text-muted-foreground">{composeModeLabel}</span>
      </div>

      <div
        className="compose-editor-surface"
        onDragOver={(e): void => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return
          e.preventDefault()
        }}
        onDrop={(e): void => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return
          e.preventDefault()
          void addFiles(Array.from(e.dataTransfer.files))
        }}
      >
      <RecipientTokenField
        inEditorSurface
        label={t('mail.composeTile.to')}
        accountId={draft.accountId}
        value={draft.to}
        onChange={(v): void => update(draft.id, { to: v })}
        showToggle={!draft.showCcBcc}
        onToggleCcBcc={(): void => update(draft.id, { showCcBcc: true })}
      />
      {draft.showCcBcc && (
        <>
          <RecipientTokenField
            inEditorSurface
            label={t('mail.composeTile.cc')}
            accountId={draft.accountId}
            value={draft.cc}
            onChange={(v): void => update(draft.id, { cc: v })}
          />
          <RecipientTokenField
            inEditorSurface
            label={t('mail.composeTile.bcc')}
            accountId={draft.accountId}
            value={draft.bcc}
            onChange={(v): void => update(draft.id, { bcc: v })}
          />
        </>
      )}

      <div className="flex shrink-0 items-center border-b border-[hsl(var(--compose-surface-border)/0.55)] px-3 py-2">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">{t('mail.composeTile.subject')}</span>
        <input
          type="text"
          value={draft.subject}
          onChange={(e): void => update(draft.id, { subject: e.target.value })}
          placeholder={t('mail.composeTile.noSubjectPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

        <TipTapBody
          inEditorSurface
          className="min-h-0 flex-1 border-t-0"
          valueHtml={draft.prependRichHtml}
          onChangeHtml={(v): void => update(draft.id, { prependRichHtml: v })}
          autoFocus
          fillHeight
        />
        <div className="shrink-0 border-t border-[hsl(var(--compose-surface-border)/0.5)] bg-[hsl(var(--compose-surface-muted))]">
          <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('mail.composeTile.signature', { defaultValue: 'Signatur' })}
            </span>
            <SignatureTemplateControls
              compact
              accountId={draft.accountId}
              signatureRichHtml={draft.signatureRichHtml}
              activeTemplateId={draft.signatureTemplateId ?? null}
              onSignatureHtmlChange={(html): void => update(draft.id, { signatureRichHtml: html })}
              onActiveTemplateIdChange={(id): void => update(draft.id, { signatureTemplateId: id })}
            />
          </div>
          <TipTapBody
            inEditorSurface
            variant="compact"
            fillHeight={false}
            className="border-t-0"
            valueHtml={draft.signatureRichHtml}
            onChangeHtml={(v): void => update(draft.id, { signatureRichHtml: v })}
          />
        </div>
      </div>

      {draft.quotedHtml && (
        <div className="shrink-0 border-t border-border/60 bg-background/40 px-3 py-2">
          <button
            type="button"
            onClick={(): void => setShowQuoted((v) => !v)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', !showQuoted && '-rotate-90')}
            />
            {showQuoted
              ? t('mail.readingPane.hideOriginalMail')
              : t('mail.readingPane.showOriginalMail')}
          </button>
          {showQuoted && (
            <div
              className="prose-sm mt-2 max-h-[280px] overflow-y-auto rounded border border-border/40 bg-background p-2 text-[11px] leading-relaxed text-muted-foreground [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: draft.quotedHtml }}
            />
          )}
        </div>
      )}

      {draft.replyToMessageId != null && draft.mode !== 'forward' && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft.expectReply ?? false}
              onChange={(e): void => update(draft.id, { expectReply: e.target.checked })}
              className="rounded border-border"
            />
            <span>{t('mail.readingPane.expectReply')}</span>
          </label>
          <select
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground disabled:opacity-50"
            disabled={!(draft.expectReply ?? false)}
            value={String(draft.expectReplyDays ?? 7)}
            onChange={(e): void =>
              update(draft.id, { expectReplyDays: Number.parseInt(e.target.value, 10) })
            }
          >
            <option value="3">3 {t('mail.readingPane.days')}</option>
            <option value="7">7 {t('mail.readingPane.days')}</option>
            <option value="14">14 {t('mail.readingPane.days')}</option>
          </select>
        </div>
      )}

      {(draft.attachments.length > 0 || attachmentError) && (
        <div className="max-h-24 shrink-0 overflow-y-auto border-t border-border/60 bg-secondary/15 px-3 py-2">
          {attachmentError && (
            <div className="mb-1 flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{attachmentError}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {draft.attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px]"
              >
                <span className="truncate">{a.name}</span>
                <span className="text-muted-foreground">({formatBytes(a.size)})</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t('mail.composeTile.removeAttachmentAria')}
                  onClick={(): void => removeAttachment(draft.id, a.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {draft.error && (
        <div className="flex shrink-0 items-start gap-2 border-t border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{draft.error}</span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={(): void => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {t('mail.composeTile.attachment')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e): void => {
            const files = e.target.files
            if (files && files.length > 0) void addFiles(Array.from(files))
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
