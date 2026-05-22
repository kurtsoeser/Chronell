import { useEffect, useState } from 'react'
import { SnoozePicker } from './SnoozePicker'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { useMailStore } from '@/stores/mail'
import type { SnoozePreset } from '@shared/types'

interface MessageSnoozeMeta {
  snoozedUntil: string | null
}

/**
 * Globaler Container fuer den Snooze-Picker. Lebt einmal in `App.tsx`
 * und reagiert auf Signale aus `useSnoozeUiStore`. Damit koennen
 * Triage-Bar, MailRow und globale Shortcuts gleichermassen den Picker
 * oeffnen, ohne ihn lokal zu rendern.
 */
export function SnoozePickerHost(): JSX.Element {
  const pendingMessageId = useSnoozeUiStore((s) => s.pendingMessageId)
  const bulkMessageIds = useSnoozeUiStore((s) => s.bulkMessageIds)
  const anchor = useSnoozeUiStore((s) => s.anchor)
  const close = useSnoozeUiStore((s) => s.close)
  const snoozeMessage = useMailStore((s) => s.snoozeMessage)
  const unsnoozeMessage = useMailStore((s) => s.unsnoozeMessage)

  const [meta, setMeta] = useState<MessageSnoozeMeta | null>(null)

  // Wenn der Picker geoeffnet wird, holen wir den aktuellen Snooze-Status
  // der Mail (falls bereits gesnoozt). So kann der Picker oben anzeigen
  // "Aktuell gesnoozt bis ..." und ein "Snooze aufheben"-Button anbieten.
  useEffect(() => {
    if (pendingMessageId == null) {
      setMeta(null)
      return
    }
    let cancelled = false
    void window.mailClient.mail.getMessage(pendingMessageId).then((m) => {
      if (cancelled) return
      // MailFull liefert snoozedUntil aktuell nicht direkt - wir nehmen
      // einen Loose-Cast, weil das Backend das Feld in der Antwort traegt,
      // sobald wir den Reader-Mapper erweitern. Bis dahin ist der Wert
      // einfach undefined und der Picker bleibt im "noch nicht gesnoozt"-Modus.
      const looseM = m as unknown as { snoozedUntil?: string | null }
      setMeta({ snoozedUntil: looseM?.snoozedUntil ?? null })
    })
    return (): void => {
      cancelled = true
    }
  }, [pendingMessageId])

  function snoozeTargets(): number[] {
    if (bulkMessageIds && bulkMessageIds.length > 0) return bulkMessageIds
    if (pendingMessageId != null) return [pendingMessageId]
    return []
  }

  function handleSelect(wakeAtIso: string, preset: SnoozePreset): void {
    const targets = snoozeTargets()
    if (targets.length === 0) return
    void (async (): Promise<void> => {
      for (const id of targets) await snoozeMessage(id, wakeAtIso, preset)
    })()
  }

  function handleClear(): void {
    const targets = snoozeTargets()
    if (targets.length === 0) return
    void (async (): Promise<void> => {
      for (const id of targets) await unsnoozeMessage(id)
    })()
  }

  return (
    <SnoozePicker
      anchorPosition={anchor}
      currentSnoozeIso={meta?.snoozedUntil ?? null}
      onClose={close}
      onSelect={handleSelect}
      onClear={meta?.snoozedUntil ? handleClear : undefined}
    />
  )
}
