export const QUICKSTEPS_CHANGED_EVENT = 'mailclient:quicksteps-changed'

export function dispatchQuickStepsChanged(): void {
  window.dispatchEvent(new CustomEvent(QUICKSTEPS_CHANGED_EVENT))
}
