import { useCallback, useRef, useState } from 'react'
import { AlertCircle, Loader2, Save, Send, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ComposeFromField } from '@/components/ComposeFromField'
import { ComposeMessageOptionsButton } from '@/components/ComposeMessageOptionsDialog'
import { ComposeEditorSurface } from '@/components/ComposeEditorSurface'
import { ComposeEditorThemedPane } from '@/components/ComposeEditorThemedPane'
import { ComposeMailBodyTile } from '@/components/ComposeMailBodyTile'
import { ComposeMailBodyResizableLayout } from '@/components/ComposeMailBodyResizableLayout'
import { composeMailBodyShellClass } from '@/lib/chronell-ui-classes'
import { ComposeEditorThemeToggle } from '@/components/ComposeEditorThemeToggle'
import { TipTapBody } from '@/components/TipTapBody'
import { ComposeCollapsibleSection } from '@/components/ComposeCollapsibleSection'
import { ComposeQuotedMailPreview } from '@/components/ComposeQuotedMailPreview'
import { SignatureFooterEditor } from '@/components/SignatureFooterEditor'
import { ComposeAttachmentsStrip } from '@/components/ComposeAttachmentsStrip'
import { OneDriveExplorerDialog } from '@/components/OneDriveExplorerDialog'
import { SignatureTemplateControls } from '@/components/SignatureTemplateControls'
import { RecipientTokenField } from '@/components/RecipientTokenField'
import { cn } from '@/lib/utils'
import { useComposeCloudDrive } from '@/hooks/useComposeCloudDrive'
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
  hidePopOutButton = false
}: {
  draft: ComposeDraft
  onPopOut?: () => void
  hidePopOutButton?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const update = useComposeStore((s) => s.update)
  const send = useComposeStore((s) => s.send)
  const saveRemoteDraft = useComposeStore((s) => s.saveRemoteDraft)
  const discardDraft = useComposeStore((s) => s.discardDraft)
  const addAttachments = useComposeStore((s) => s.addAttachments)
  const removeAttachment = useComposeStore((s) => s.removeAttachment)

  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  useComposeAutoSave(draft.id, true)

  const account = accounts.find((a) => a.id === draft.accountId) ?? accounts[0]
  const isMicrosoft = account?.provider === 'microsoft'
  const attachmentsTotal = draft.attachments.reduce((s, a) => s + a.size, 0)
  const {
    driveOpen,
    setDriveOpen,
    openDrive,
    addCloudAttachment,
    removeCloudAttachment,
    insertCloudLinkInBody
  } = useComposeCloudDrive(draft.id)

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
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
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
        <ComposeFromField
          variant="inline"
          accountId={draft.accountId}
          sendFromEmail={draft.sendFromEmail ?? null}
          onAccountChange={(id): void =>
            update(draft.id, {
              accountId: id,
              sendFromEmail: null,
              savedRemoteDraftId: undefined
            })
          }
          onSendFromChange={(email): void => update(draft.id, { sendFromEmail: email })}
        />
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          disabled={draft.busy}
          title={t('mail.composeTile.saveDraft')}
          aria-label={t('mail.composeTile.saveDraft')}
          onClick={(): void => void saveRemoteDraft(draft.id)}
          className={cn(
            'rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground',
            draft.busy && 'pointer-events-none opacity-50'
          )}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={draft.busy}
          title={t('mail.compose.discardAria')}
          aria-label={t('mail.compose.discardAria')}
          onClick={(): void => void discardDraft(draft.id)}
          className={cn(
            'rounded-md border border-border p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive',
            draft.busy && 'pointer-events-none opacity-50'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <ComposeEditorThemeToggle />
        <ComposeMessageOptionsButton
          isMicrosoft={account?.provider === 'microsoft'}
          values={{
            importance: draft.importance,
            isReadReceiptRequested: draft.isReadReceiptRequested,
            isDeliveryReceiptRequested: draft.isDeliveryReceiptRequested,
            smimeEncrypt: draft.smimeEncrypt,
            smimeSign: draft.smimeSign,
            scheduledSendAt: draft.scheduledSendAt
          }}
          onApply={(v): void =>
            update(draft.id, {
              importance: v.importance,
              isReadReceiptRequested: v.isReadReceiptRequested,
              isDeliveryReceiptRequested: v.isDeliveryReceiptRequested,
              smimeEncrypt: v.smimeEncrypt,
              smimeSign: v.smimeSign,
              scheduledSendAt: v.scheduledSendAt
            })
          }
        />
        {!hidePopOutButton && onPopOut ? (
          <button
            type="button"
            title={t('mail.readingPane.composePopOutTitle')}
            aria-label={t('mail.readingPane.composePopOutTitle')}
            onClick={onPopOut}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <ComposeEditorSurface
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
        <div className={cn(composeMailBodyShellClass, 'overflow-hidden')}>
          <ComposeMailBodyResizableLayout
            editor={
              <ComposeMailBodyTile className="flex h-full min-h-0 flex-col">
                <div className="compose-mail-chrome shrink-0">
                  <RecipientTokenField
                    inMailTile
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
                        inMailTile
                        label={t('mail.composeTile.cc')}
                        accountId={draft.accountId}
                        value={draft.cc}
                        onChange={(v): void => update(draft.id, { cc: v })}
                      />
                      <RecipientTokenField
                        inMailTile
                        label={t('mail.composeTile.bcc')}
                        accountId={draft.accountId}
                        value={draft.bcc}
                        onChange={(v): void => update(draft.id, { bcc: v })}
                      />
                    </>
                  )}
                  <div className="flex shrink-0 items-center px-3 py-2">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">
                      {t('mail.composeTile.subject')}
                    </span>
                    <input
                      type="text"
                      value={draft.subject}
                      onChange={(e): void => update(draft.id, { subject: e.target.value })}
                      placeholder={t('mail.composeTile.noSubjectPlaceholder')}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <ComposeEditorThemedPane className="compose-mail-editor-section min-h-0 flex-1">
                  <TipTapBody
                    inEditorSurface
                    className="min-h-0 flex-1 border-t-0"
                    valueHtml={draft.prependRichHtml}
                    onChangeHtml={(v): void => update(draft.id, { prependRichHtml: v })}
                    onAttachFiles={(files): void => void addFiles(files)}
                    attachmentCount={draft.attachments.length}
                    onCloudAttach={isMicrosoft ? openDrive : undefined}
                    cloudAttachmentCount={draft.referenceAttachments.length}
                    autoFocus
                    fillHeight
                  />
                </ComposeEditorThemedPane>
              </ComposeMailBodyTile>
            }
            bottom={
              <>
                <ComposeCollapsibleSection
                  className="shrink-0"
                  framed
                  label={t('mail.composeTile.signature', { defaultValue: 'Signatur' })}
                  collapsedDefault
                  headerAside={
                    <SignatureTemplateControls
                      compact
                      accountId={draft.accountId}
                      signatureRichHtml={draft.signatureRichHtml}
                      activeTemplateId={draft.signatureTemplateId ?? null}
                      onSignatureHtmlChange={(html): void => update(draft.id, { signatureRichHtml: html })}
                      onActiveTemplateIdChange={(id): void => update(draft.id, { signatureTemplateId: id })}
                    />
                  }
                >
                  <ComposeEditorThemedPane>
                    <SignatureFooterEditor
                      valueHtml={draft.signatureRichHtml}
                      onChangeHtml={(v): void => update(draft.id, { signatureRichHtml: v })}
                    />
                  </ComposeEditorThemedPane>
                </ComposeCollapsibleSection>
                {draft.quotedHtml ? (
                  <ComposeCollapsibleSection
                    className="shrink-0"
                    label={t('mail.composeTile.originalMail', { defaultValue: 'Original-Mail' })}
                    framed
                  >
                    <div className="p-2 pt-0">
                      <ComposeQuotedMailPreview quotedHtml={draft.quotedHtml} />
                    </div>
                  </ComposeCollapsibleSection>
                ) : null}
              </>
            }
          />
        </div>
      </ComposeEditorSurface>

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

      <ComposeAttachmentsStrip
        attachments={draft.attachments}
        referenceAttachments={draft.referenceAttachments}
        attachmentError={attachmentError}
        onRemoveLocal={(id): void => removeAttachment(draft.id, id)}
        onRemoveCloud={removeCloudAttachment}
      />
      {isMicrosoft ? (
        <OneDriveExplorerDialog
          open={driveOpen}
          accountId={draft.accountId}
          onClose={(): void => setDriveOpen(false)}
          onPickFile={addCloudAttachment}
          onInsertLinkInBody={insertCloudLinkInBody}
        />
      ) : null}

      {draft.error && (
        <div className="flex shrink-0 items-start gap-2 border-t border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{draft.error}</span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          disabled={draft.busy}
          onClick={(): void => void send(draft.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
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
      </div>
    </div>
  )
}
