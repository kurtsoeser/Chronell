import { useCallback, useEffect, useState } from 'react'
import {
  loadCustomNotePageTemplates,
  NOTE_PAGE_TEMPLATES_CUSTOM_CHANGED,
  type CustomNotePageTemplate
} from '@/lib/note-page-templates-custom'

export function useCustomNotePageTemplates(): {
  customTemplates: CustomNotePageTemplate[]
  refreshCustomTemplates: () => void
} {
  const [customTemplates, setCustomTemplates] = useState<CustomNotePageTemplate[]>(() =>
    loadCustomNotePageTemplates()
  )

  const refreshCustomTemplates = useCallback((): void => {
    setCustomTemplates(loadCustomNotePageTemplates())
  }, [])

  useEffect(() => {
    const onChanged = (): void => refreshCustomTemplates()
    window.addEventListener(NOTE_PAGE_TEMPLATES_CUSTOM_CHANGED, onChanged)
    return (): void => window.removeEventListener(NOTE_PAGE_TEMPLATES_CUSTOM_CHANGED, onChanged)
  }, [refreshCustomTemplates])

  return { customTemplates, refreshCustomTemplates }
}
