import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import {
  NOTE_FORM_FIELD_CLASS,
  NOTE_FORM_FIELD_DATE_CLASS,
  NOTE_FORM_FIELD_TIME_CLASS
} from '@shared/note-form-field'
import { cn } from '@/lib/utils'

const NOTE_FIELD_POPOVER_Z = 320

function stopEditorMouseDown(e: React.MouseEvent): void {
  e.stopPropagation()
}

export function NoteDateFieldNodeView({ node, updateAttributes, selected }: NodeViewProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        NOTE_FORM_FIELD_CLASS,
        NOTE_FORM_FIELD_DATE_CLASS,
        'chronell-note-field-node inline align-baseline',
        selected && 'rounded-sm ring-1 ring-ring/40'
      )}
      contentEditable={false}
      onMouseDown={stopEditorMouseDown}
    >
      <ChronellDateField
        variant="inline"
        value={typeof node.attrs.value === 'string' ? node.attrs.value : ''}
        onChange={(ymd): void => {
          updateAttributes({ value: ymd })
        }}
        popoverZIndex={NOTE_FIELD_POPOVER_Z}
        aria-label={t('notes.formField.dateAria')}
      />
    </NodeViewWrapper>
  )
}

export function NoteTimeFieldNodeView({ node, updateAttributes, selected }: NodeViewProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        NOTE_FORM_FIELD_CLASS,
        NOTE_FORM_FIELD_TIME_CLASS,
        'chronell-note-field-node inline align-baseline',
        selected && 'rounded-sm ring-1 ring-ring/40'
      )}
      contentEditable={false}
      onMouseDown={stopEditorMouseDown}
    >
      <ChronellTimeField
        variant="inline"
        value={typeof node.attrs.value === 'string' ? node.attrs.value : ''}
        onChange={(hm): void => {
          updateAttributes({ value: hm })
        }}
        aria-label={t('notes.formField.timeAria')}
      />
    </NodeViewWrapper>
  )
}
