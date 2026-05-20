import type { ChronellEntityRef } from '@shared/entity-ref'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'

/** @deprecated Verwende {@link EntityContextBlock}. */
export function ConnectionsPanel(props: {
  anchor: ChronellEntityRef
  className?: string
  sectionCollapsedDefault?: boolean
  contentPaddingClass?: string
}): JSX.Element {
  return <EntityContextBlock {...props} showObjectNote={false} />
}
