import { getQuickStepById } from './db/quicksteps-repo'
import { parseQuickStepActionsJson } from '@shared/quicksteps'
import { executeQuickStepActions } from './quickstep-actions'

/**
 * Fuehrt einen gespeicherten QuickStep fuer eine Mail aus.
 * Aktionen werden sequentiell ausgefuehrt (logisches UND).
 */
export async function runQuickStep(quickstepId: number, messageId: number): Promise<void> {
  const row = getQuickStepById(quickstepId)
  if (!row || !row.enabled) throw new Error('QuickStep nicht gefunden.')

  const actions = parseQuickStepActionsJson(row.actionsJson)
  if (actions.length === 0) {
    throw new Error('QuickStep hat keine gueltigen Aktionen.')
  }

  await executeQuickStepActions(actions, messageId, 'quickstep')
}
