import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Save, Send, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ComposeFromField } from '@/components/ComposeFromField'
import { ComposeMessageOptionsButton } from '@/components/ComposeMessageOptionsDialog'
import { ComposeEditorSurface } from '@/components/ComposeEditorSurface'
import { ComposeEditorThemedPane } from '@/components/ComposeEditorThemedPane'
import { ComposeMailBodyTile } from '@/components/ComposeMailBodyTile'
import { composeMailBodyShellClass } from '@/lib/chronell-ui-classes'
import { ComposeEditorThemeToggle } from '@/components/ComposeEditorThemeToggle'
import { TipTapBody } from '@/components/TipTapBody'
import { SignatureFooterEditor } from '@/components/SignatureFooterEditor'
import { ComposeAttachmentsStrip } from '@/components/ComposeAttachmentsStrip'
import { OneDriveExplorerDialog } from '@/components/OneDriveExplorerDialog'
import { SignatureTemplateControls } from '@/components/SignatureTemplateControls'
import { RecipientTokenField } from '@/components/RecipientTokenField'
import { cn } from '@/lib/utils'
import { useComposeCloudDrive } from '@/hooks/useComposeCloudDrive'
import { useAccountsStore } from '@/stores/accounts'
import { useComposeStore, type ComposeAttachmentFile } from '@/stores/compose'
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

export function DashboardComposeTile(): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const embedDraft = useComposeStore((s) => s.drafts.find((d) => d.embedInDashboard) ?? null)
  const ensureDashboardEmbedDraft = useComposeStore((s) => s.ensureDashboardEmbedDraft)
  const update = useComposeStore((s) => s.update)
  const send = useComposeStore((s) => s.send)
  const saveRemoteDraft = useComposeStore((s) => s.saveRemoteDraft)
  const discardDraft = useComposeStore((s) => s.discardDraft)
  const addAttachments = useComposeStore((s) => s.addAttachments)
  const removeAttachment = useComposeStore((s) => s.removeAttachment)

  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  useEffect(() => {
    const first = accounts[0]?.id
    if (!first) return
    if (!useComposeStore.getState().drafts.some((d) => d.embedInDashboard)) {
      ensureDashboardEmbedDraft(first)
    }
  }, [accounts, ensureDashboardEmbedDraft])

  const draft = embedDraft
  const attachmentsTotal = draft?.attachments.reduce((s, a) => s + a.size, 0) ?? 0
  const cloudDrive = useComposeCloudDrive(draft?.id ?? '')

  useComposeAutoSave(draft?.id ?? '', Boolean(draft))

  const addFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (!draft || files.length === 0) return
      setAttachmentError(null)
      try {
        const next: ComposeAttachmentFile[] = []
        let running = attachmentsTotal
        for (const f of files) {
          if (running + f.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
            setAttachmentError(
              t('mail.composeTile.attachmentMax', {
                maxMb: (MAX_ATTACHMENTS_TOTAL_BYTES / (1024 * 1024)).toFixed(0),
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
        setAttachmentError(err instanceof Error ? err.message : String(err))
      }
    },
    [addAttachments, attachmentsTotal, draft, t]
  )

  if (accounts.length === 0 || !draft) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
        {t('mail.composeTile.needAccount')}
      </div>
    )
  }

  const account = accounts.find((a) => a.id === draft.accountId) ?? accounts[0]
  const isMicrosoft = account?.provider === 'microsoft'

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card/40"
      onDragOver={(e): void => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e): void => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return
        e.preventDefault()
        void addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-2 py-1.5 text-[11px]">
        <ComposeEditorThemeToggle compact />
        <ComposeMessageOptionsButton
          compact
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
        <button
          type="button"
          disabled={draft.busy}
          title={t('mail.composeTile.saveDraft')}
          onClick={(): void => void saveRemoteDraft(draft.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 font-medium text-foreground hover:bg-secondary',
            draft.busy && 'pointer-events-none opacity-50'
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {t('mail.composeTile.saveDraft')}
        </button>
        <button
          type="button"
          disabled={draft.busy}
          title={t('mail.compose.discardAria')}
          aria-label={t('mail.compose.discardAria')}
          onClick={(): void => void discardDraft(draft.id)}
          className={cn(
            'inline-flex shrink-0 items-center rounded-md border border-border p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive',
            draft.busy && 'pointer-events-none opacity-50'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ComposeEditorSurface className="min-h-0 flex-1">
        <div className={composeMailBodyShellClass}>
          <ComposeMailBodyTile className="min-h-[10rem] flex-1">
            <div className="compose-mail-chrome shrink-0">
              <RecipientTokenField
                inMailTile
                label={t('mail.composeTile.to')}
                accountId={draft.accountId}
                value={draft.to}
                onChange={(v): void => update(draft.id, { to: v })}
                showToggle={!draft.showCcBcc}
                onToggleCcBcc={(): void => update(draft.id, { showCcBcc: true })}
                className="px-2 py-1"
              />
              {draft.showCcBcc && (
                <>
                  <RecipientTokenField
                    inMailTile
                    label={t('mail.composeTile.cc')}
                    accountId={draft.accountId}
                    value={draft.cc}
                    onChange={(v): void => update(draft.id, { cc: v })}
                    className="px-2 py-1"
                  />
                  <RecipientTokenField
                    inMailTile
                    label={t('mail.composeTile.bcc')}
                    accountId={draft.accountId}
                    value={draft.bcc}
                    onChange={(v): void => update(draft.id, { bcc: v })}
                    className="px-2 py-1"
                  />
                </>
              )}
              <div className="flex shrink-0 items-center gap-2 px-2 py-1.5">
                <span className="w-9 shrink-0 text-[10px] text-muted-foreground">
                  {t('mail.composeTile.subject')}
                </span>
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(e): void => update(draft.id, { subject: e.target.value })}
                  placeholder={t('mail.composeTile.noSubjectPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <ComposeEditorThemedPane className="compose-mail-editor-section min-h-0 flex-1">
              <TipTapBody
                inEditorSurface
                valueHtml={draft.prependRichHtml}
                onChangeHtml={(v): void => update(draft.id, { prependRichHtml: v })}
                onAttachFiles={(files): void => void addFiles(files)}
                attachmentCount={draft.attachments.length}
                onCloudAttach={isMicrosoft ? cloudDrive.openDrive : undefined}
                cloudAttachmentCount={draft.referenceAttachments.length}
                className="min-h-0 flex-1 border-t-0"
                fillHeight
              />
            </ComposeEditorThemedPane>
          </ComposeMailBodyTile>
          <ComposeMailBodyTile className="shrink-0">
            <div className="flex flex-wrap items-start justify-between gap-1 border-b border-[hsl(var(--compose-surface-border)/0.45)] px-2 py-1">
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
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
            <ComposeEditorThemedPane>
              <SignatureFooterEditor
                valueHtml={draft.signatureRichHtml}
                onChangeHtml={(v): void => update(draft.id, { signatureRichHtml: v })}
              />
            </ComposeEditorThemedPane>
          </ComposeMailBodyTile>
        </div>
      </ComposeEditorSurface>

      <ComposeAttachmentsStrip
        compact
        attachments={draft.attachments}
        referenceAttachments={draft.referenceAttachments}
        attachmentError={attachmentError}
        onRemoveLocal={(id): void => removeAttachment(draft.id, id)}
        onRemoveCloud={cloudDrive.removeCloudAttachment}
      />
      {isMicrosoft ? (
        <OneDriveExplorerDialog
          open={cloudDrive.driveOpen}
          accountId={draft.accountId}
          onClose={(): void => cloudDrive.setDriveOpen(false)}
          onPickFile={cloudDrive.addCloudAttachment}
          onInsertLinkInBody={cloudDrive.insertCloudLinkInBody}
        />
      ) : null}

      {draft.error && (
        <div className="flex shrink-0 items-start gap-1 border-t border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 flex-1">{draft.error}</span>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-2 py-1.5">
        <ComposeFromField
          variant="inline"
          className="text-[11px]"
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
          onClick={(): void => void send(draft.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold',
            draft.busy
              ? 'bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {draft.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {t('mail.composeTile.send')}
        </button>
        <button
          type="button"
          disabled={draft.busy}
          onClick={(): void => {
            void (async (): Promise<void> => {
              const discarded = await discardDraft(draft.id)
              if (!discarded) return
              const first = useAccountsStore.getState().accounts[0]?.id
              if (first) ensureDashboardEmbedDraft(first)
            })()
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {t('mail.composeTile.clear')}
        </button>
      </div>
    </div>
  )
}
