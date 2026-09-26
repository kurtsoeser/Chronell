import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Link2Off,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2
} from 'lucide-react'
import {
  applyHtmlDocumentWysiwygProtectedRegions,
  buildHtmlDocumentWysiwygShell,
  execHtmlDocumentWysiwygCommand,
  extractHtmlDocumentWysiwygBody,
  focusHtmlDocumentWysiwyg,
  HTML_DOCUMENT_WYSIWYG_DEFAULT_PROTECTED,
  queryHtmlDocumentWysiwygCommandState
} from '@/lib/html-document-wysiwyg'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'
import { showAppPrompt } from '@/stores/app-dialog'
import { cn } from '@/lib/utils'

export interface HtmlDocumentWysiwygEditorProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  flushRef?: MutableRefObject<(() => string) | null>
  disabled?: boolean
  className?: string
  minHeightClass?: string
  sanitize?: (html: string) => string
  protectedSelectors?: readonly string[]
  placeholder?: string
  toolbarExtra?: ReactNode
}

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e): void => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-foreground/80 hover:bg-secondary hover:text-foreground disabled:opacity-40',
        active && 'border-border bg-secondary text-foreground'
      )}
    >
      {children}
    </button>
  )
}

/**
 * HTML-WYSIWYG fuer komplexe Einladungs-Layouts (Tabellen, Inline-Styles).
 * Bearbeitet das echte TN-HTML per iframe/designMode — Tabellen bleiben erhalten.
 */
export function HtmlDocumentWysiwygEditor({
  valueHtml,
  onChangeHtml,
  flushRef,
  disabled = false,
  className,
  minHeightClass = 'min-h-[360px]',
  sanitize = sanitizeWebinarInvitationHtml,
  protectedSelectors = HTML_DOCUMENT_WYSIWYG_DEFAULT_PROTECTED,
  placeholder,
  toolbarExtra
}: HtmlDocumentWysiwygEditorProps): JSX.Element {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const lastEmittedRef = useRef('')
  const focusedRef = useRef(false)
  const iframeReadyRef = useRef(false)
  const valueHtmlRef = useRef(valueHtml)
  const onChangeRef = useRef(onChangeHtml)
  const sanitizeRef = useRef(sanitize)
  const protectedRef = useRef(protectedSelectors)
  const [toolbarTick, setToolbarTick] = useState(0)

  valueHtmlRef.current = valueHtml
  onChangeRef.current = onChangeHtml
  sanitizeRef.current = sanitize
  protectedRef.current = protectedSelectors

  const getDoc = useCallback((): Document | null => {
    return iframeRef.current?.contentDocument ?? null
  }, [])

  const readBodyHtml = useCallback((): string => {
    const raw = extractHtmlDocumentWysiwygBody(getDoc())
    return raw ? sanitizeRef.current(raw) : ''
  }, [getDoc])

  const writeBodyHtml = useCallback((html: string): void => {
    const doc = iframeRef.current?.contentDocument ?? null
    if (!doc) return
    const safe = sanitizeRef.current(html.trim())
    doc.open()
    doc.write(buildHtmlDocumentWysiwygShell(safe))
    doc.close()
    doc.designMode = disabled ? 'off' : 'on'
    applyHtmlDocumentWysiwygProtectedRegions(doc, protectedRef.current)
    lastEmittedRef.current = safe
  }, [disabled])

  const emitChange = useCallback((): string => {
    const next = readBodyHtml()
    if (next !== lastEmittedRef.current) {
      lastEmittedRef.current = next
      onChangeRef.current(next)
    }
    return next
  }, [readBodyHtml])

  const runCommand = useCallback(
    (command: string, value?: string): void => {
      if (disabled) return
      const doc = getDoc()
      execHtmlDocumentWysiwygCommand(doc, command, value)
      focusHtmlDocumentWysiwyg(doc)
      emitChange()
      setToolbarTick((n) => n + 1)
    },
    [disabled, emitChange, getDoc]
  )

  const handleLink = useCallback(async (): Promise<void> => {
    if (disabled) return
    const url = await showAppPrompt(t('htmlDocumentWysiwyg.linkPrompt'), {
      title: t('htmlDocumentWysiwyg.linkTitle'),
      defaultValue: 'https://'
    })
    if (!url?.trim()) return
    runCommand('createLink', url.trim())
  }, [disabled, runCommand, t])

  const handleImagePick = useCallback(
    (file: File | undefined): void => {
      if (!file || disabled) return
      const reader = new FileReader()
      reader.onload = (): void => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!dataUrl) return
        runCommand('insertImage', dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [disabled, runCommand]
  )

  useEffect(() => {
    if (!flushRef) return
    flushRef.current = (): string => emitChange()
    return (): void => {
      flushRef.current = null
    }
  }, [emitChange, flushRef])

  /** iframe + Listener einmal mounten — nicht bei jedem valueHtml-Update neu aufbauen. */
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let detachDocListeners: (() => void) | undefined

    const bindDocument = (): void => {
      detachDocListeners?.()
      const doc = iframe.contentDocument
      if (!doc?.body) return

      const onInput = (): void => {
        emitChange()
        setToolbarTick((n) => n + 1)
      }
      const onFocusIn = (): void => {
        focusedRef.current = true
        setToolbarTick((n) => n + 1)
      }
      const onFocusOut = (): void => {
        focusedRef.current = false
        emitChange()
      }
      const onSelectionChange = (): void => {
        if (focusedRef.current) setToolbarTick((n) => n + 1)
      }

      doc.body.addEventListener('input', onInput)
      doc.body.addEventListener('focusin', onFocusIn)
      doc.body.addEventListener('focusout', onFocusOut)
      doc.addEventListener('selectionchange', onSelectionChange)

      detachDocListeners = (): void => {
        doc.body.removeEventListener('input', onInput)
        doc.body.removeEventListener('focusin', onFocusIn)
        doc.body.removeEventListener('focusout', onFocusOut)
        doc.removeEventListener('selectionchange', onSelectionChange)
      }
    }

    const onIframeLoad = (): void => {
      writeBodyHtml(valueHtmlRef.current)
      bindDocument()
      iframeReadyRef.current = true
    }

    iframe.addEventListener('load', onIframeLoad)
    if (iframe.contentDocument?.readyState === 'complete') {
      onIframeLoad()
    }

    return (): void => {
      iframe.removeEventListener('load', onIframeLoad)
      detachDocListeners?.()
      iframeReadyRef.current = false
    }
  }, [emitChange, writeBodyHtml])

  /** Externe HTML-Aenderungen (Laden, Vorlage) — nie waehrend der Eingabe. */
  useEffect(() => {
    if (!iframeReadyRef.current) return
    if (focusedRef.current) return
    const external = sanitizeRef.current(valueHtml.trim())
    if (external === lastEmittedRef.current) return
    writeBodyHtml(external)
  }, [valueHtml, writeBodyHtml])

  useEffect(() => {
    const doc = getDoc()
    if (doc) doc.designMode = disabled ? 'off' : 'on'
  }, [disabled, getDoc, toolbarTick])

  const doc = getDoc()
  const isEmpty = !valueHtml.trim()
  void toolbarTick

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-[#0d0d0d]',
        disabled && 'opacity-60',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-card/80 px-1.5 py-1">
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.bold')}
          disabled={disabled}
          active={queryHtmlDocumentWysiwygCommandState(doc, 'bold')}
          onClick={(): void => runCommand('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.italic')}
          disabled={disabled}
          active={queryHtmlDocumentWysiwygCommandState(doc, 'italic')}
          onClick={(): void => runCommand('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.underline')}
          disabled={disabled}
          active={queryHtmlDocumentWysiwygCommandState(doc, 'underline')}
          onClick={(): void => runCommand('underline')}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.strike')}
          disabled={disabled}
          active={queryHtmlDocumentWysiwygCommandState(doc, 'strikeThrough')}
          onClick={(): void => runCommand('strikeThrough')}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
        <ToolbarButton title={t('htmlDocumentWysiwyg.link')} disabled={disabled} onClick={(): void => void handleLink()}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.unlink')}
          disabled={disabled}
          onClick={(): void => runCommand('unlink')}
        >
          <Link2Off className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.bulletList')}
          disabled={disabled}
          onClick={(): void => runCommand('insertUnorderedList')}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.numberList')}
          disabled={disabled}
          onClick={(): void => runCommand('insertOrderedList')}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.alignLeft')}
          disabled={disabled}
          onClick={(): void => runCommand('justifyLeft')}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.alignCenter')}
          disabled={disabled}
          onClick={(): void => runCommand('justifyCenter')}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={t('htmlDocumentWysiwyg.alignRight')}
          disabled={disabled}
          onClick={(): void => runCommand('justifyRight')}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
        <ToolbarButton title={t('htmlDocumentWysiwyg.image')} disabled={disabled} onClick={(): void => imageInputRef.current?.click()}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
        <ToolbarButton title={t('htmlDocumentWysiwyg.undo')} disabled={disabled} onClick={(): void => runCommand('undo')}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t('htmlDocumentWysiwyg.redo')} disabled={disabled} onClick={(): void => runCommand('redo')}>
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        {toolbarExtra ? (
          <>
            <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
            {toolbarExtra}
          </>
        ) : null}
      </div>

      <div className={cn('relative', minHeightClass)}>
        {isEmpty && placeholder ? (
          <p className="pointer-events-none absolute inset-x-0 top-3 px-4 text-sm italic text-muted-foreground/80">
            {placeholder}
          </p>
        ) : null}
        <iframe
          ref={iframeRef}
          title={t('htmlDocumentWysiwyg.iframeTitle')}
          className={cn('block w-full border-0 bg-transparent', minHeightClass)}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e): void => {
          handleImagePick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
