import type { MailTableBorderStyle, MailTableDesign } from '@/components/tiptap-mail-table'

export interface MailTablePreset {
  id: MailTableDesign
  label: string
  description: string
}

export interface MailTableBorderOption {
  id: MailTableBorderStyle
  label: string
}

export const MAIL_TABLE_PRESETS: MailTablePreset[] = [
  { id: 'bordered', label: 'Standard', description: 'Gitter mit Kopfzeile' },
  { id: 'banded-rows', label: 'Gebänderte Zeilen', description: 'Abwechselnde Zeilenfarben' },
  { id: 'banded-columns', label: 'Gebänderte Spalten', description: 'Abwechselnde Spaltenfarben' },
  { id: 'header-accent', label: 'Kopfzeile akzent', description: 'Hervorgehobene Kopfzeile' },
  { id: 'outline', label: 'Umriss', description: 'Nur äußerer Rahmen' },
  { id: 'minimal', label: 'Schlicht', description: 'Nur horizontale Linien' },
  { id: 'borderless', label: 'Ohne Rahmen', description: 'Keine sichtbaren Linien' },
  { id: 'shadow', label: 'Mit Schatten', description: 'Leichter Schatten um die Tabelle' }
]

export const MAIL_TABLE_BORDER_OPTIONS: MailTableBorderOption[] = [
  { id: 'full', label: 'Alle Linien' },
  { id: 'outer', label: 'Nur außen' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'dashed', label: 'Gestrichelt' },
  { id: 'none', label: 'Keine' }
]
