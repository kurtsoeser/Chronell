import { TipTapBody } from '@/components/TipTapBody'
import { ComposeEditorSurface } from '@/components/ComposeEditorSurface'
import { ComposeEditorThemedPane } from '@/components/ComposeEditorThemedPane'
import { cn } from '@/lib/utils'

export interface SignatureFooterEditorProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  placeholder?: string
  fillHeight?: boolean
  editorMinHeightClass?: string
  className?: string
  /**
   * `embedded`: innerhalb von ComposeEditorThemedPane (Composer).
   * `standalone`: mit eigener Compose-Oberfläche (Einstellungen).
   */
  layout?: 'embedded' | 'standalone'
}

/** Rich-Text-Editor für Signatur/Footer — gleiche Toolbar wie der Mail-Nachrichtentext. */
export function SignatureFooterEditor({
  valueHtml,
  onChangeHtml,
  placeholder,
  fillHeight = false,
  editorMinHeightClass = 'min-h-[10rem]',
  className,
  layout = 'embedded'
}: SignatureFooterEditorProps): JSX.Element {
  const body = (
    <TipTapBody
      inEditorSurface
      variant="default"
      valueHtml={valueHtml}
      onChangeHtml={onChangeHtml}
      placeholder={placeholder}
      fillHeight={fillHeight}
      editorMinHeightClass={editorMinHeightClass}
      className={cn('border-t-0', className)}
    />
  )

  if (layout === 'embedded') {
    return body
  }

  return (
    <ComposeEditorSurface className="overflow-hidden rounded-md">
      <ComposeEditorThemedPane>{body}</ComposeEditorThemedPane>
    </ComposeEditorSurface>
  )
}
