import { Node, mergeAttributes, type Extensions } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import {
  NOTE_FORM_FIELD_ATTR,
  NOTE_FORM_FIELD_CLASS,
  NOTE_FORM_FIELD_DATE_CLASS,
  NOTE_FORM_FIELD_TIME_CLASS,
  NOTE_FORM_FIELD_VALUE_ATTR,
  formatNoteDateFieldStorageText,
  formatNoteTimeFieldStorageText
} from '@shared/note-form-field'
import { NoteDateFieldNodeView, NoteTimeFieldNodeView } from '@/components/tiptap/NoteFormFieldNodeViews'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteDateField: {
      insertNoteDateField: (value?: string) => ReturnType
    }
    noteTimeField: {
      insertNoteTimeField: (value?: string) => ReturnType
    }
  }
}

function formFieldValueAttrs() {
  return {
    value: {
      default: '',
      parseHTML: (element: HTMLElement) => element.getAttribute(NOTE_FORM_FIELD_VALUE_ATTR) ?? '',
      renderHTML: (attributes: { value?: string }) => ({
        [NOTE_FORM_FIELD_VALUE_ATTR]: (attributes.value ?? '').trim()
      })
    }
  }
}

function formFieldRenderText(kind: 'date' | 'time', value: string): string {
  const v = value.trim()
  if (!v) return '\u00a0'
  return kind === 'date' ? formatNoteDateFieldStorageText(v) : formatNoteTimeFieldStorageText(v)
}

export const NoteDateField = Node.create({
  name: 'noteDateField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return formFieldValueAttrs()
  },

  parseHTML() {
    return [{ tag: `span[${NOTE_FORM_FIELD_ATTR}="date"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    const value = typeof HTMLAttributes.value === 'string' ? HTMLAttributes.value : ''
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `${NOTE_FORM_FIELD_CLASS} ${NOTE_FORM_FIELD_DATE_CLASS}`,
        [NOTE_FORM_FIELD_ATTR]: 'date',
        contenteditable: 'false'
      }),
      formFieldRenderText('date', value)
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteDateFieldNodeView)
  },

  addCommands() {
    return {
      insertNoteDateField:
        (value = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { value } })
    }
  }
})

export const NoteTimeField = Node.create({
  name: 'noteTimeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return formFieldValueAttrs()
  },

  parseHTML() {
    return [{ tag: `span[${NOTE_FORM_FIELD_ATTR}="time"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    const value = typeof HTMLAttributes.value === 'string' ? HTMLAttributes.value : ''
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `${NOTE_FORM_FIELD_CLASS} ${NOTE_FORM_FIELD_TIME_CLASS}`,
        [NOTE_FORM_FIELD_ATTR]: 'time',
        contenteditable: 'false'
      }),
      formFieldRenderText('time', value)
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteTimeFieldNodeView)
  },

  addCommands() {
    return {
      insertNoteTimeField:
        (value = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { value } })
    }
  }
})

export const NOTE_FORM_FIELD_TIPTAP_EXTENSIONS: Extensions = [NoteDateField, NoteTimeField]
