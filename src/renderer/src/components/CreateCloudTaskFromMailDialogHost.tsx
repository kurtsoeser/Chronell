import { CreateCloudTaskFromMailDialog } from '@/components/CreateCloudTaskFromMailDialog'
import { useCreateCloudTaskUiStore } from '@/stores/create-cloud-task-ui'

/**
 * Globaler Dialog „Mail → Cloud-Aufgabe“. Einmal in `App.tsx` mounten;
 * Kontextmenüs öffnen ihn über `useCreateCloudTaskUiStore`.
 */
export function CreateCloudTaskFromMailDialogHost(): JSX.Element {
  const pendingMessage = useCreateCloudTaskUiStore((s) => s.pendingMessage)
  const promoteTodoId = useCreateCloudTaskUiStore((s) => s.promoteTodoId)
  const close = useCreateCloudTaskUiStore((s) => s.close)
  const notifyCreated = useCreateCloudTaskUiStore((s) => s.notifyCreated)

  return (
    <CreateCloudTaskFromMailDialog
      open={pendingMessage != null}
      message={pendingMessage}
      promoteTodoId={promoteTodoId}
      onClose={close}
      onCreated={notifyCreated}
    />
  )
}
