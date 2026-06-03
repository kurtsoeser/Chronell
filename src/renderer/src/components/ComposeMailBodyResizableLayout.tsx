import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HorizontalSplitter, useResizableHeight } from '@/components/ResizableSplitter'
import {
  COMPOSE_EDITOR_BOTTOM_HEIGHT_DEFAULT,
  COMPOSE_EDITOR_BOTTOM_HEIGHT_KEY,
  COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN,
  composeEditorBottomHeightMax
} from '@/lib/compose-mail-body-layout-storage'

export function ComposeMailBodyResizableLayout({
  editor,
  bottom
}: {
  editor: ReactNode
  bottom: ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const bottomMax = composeEditorBottomHeightMax()
  const [bottomHeight, setBottomHeight] = useResizableHeight({
    storageKey: COMPOSE_EDITOR_BOTTOM_HEIGHT_KEY,
    defaultHeight: COMPOSE_EDITOR_BOTTOM_HEIGHT_DEFAULT,
    minHeight: COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN,
    maxHeight: bottomMax
  })

  useEffect(() => {
    const clamp = (): void => {
      const max = composeEditorBottomHeightMax()
      setBottomHeight((h) =>
        Math.min(max, Math.max(COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN, h))
      )
    }
    window.addEventListener('resize', clamp)
    return (): void => window.removeEventListener('resize', clamp)
  }, [setBottomHeight])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">{editor}</div>
      <HorizontalSplitter
        variant="subtle"
        ariaLabel={t('mail.composeTile.editorBottomSplitterAria')}
        onDrag={(deltaY): void => {
          setBottomHeight((h) => {
            const max = composeEditorBottomHeightMax()
            return Math.min(max, Math.max(COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN, h - deltaY))
          })
        }}
      />
      <div
        className="flex min-h-0 shrink-0 flex-col gap-2 overflow-y-auto"
        style={{ height: Math.min(bottomHeight, bottomMax) }}
      >
        {bottom}
      </div>
    </div>
  )
}
