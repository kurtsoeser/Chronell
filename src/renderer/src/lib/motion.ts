/** Durations (ms) for exit-delay logic — keep in sync with Tailwind duration classes. */
export const MOTION_EXIT_MS = 150
export const MOTION_OVERLAY_EXIT_MS = 120
export const MOTION_TOAST_EXIT_MS = 150
export const MOTION_LIST_EXIT_MS = 150

export const motionOverlayIn = 'animate-in fade-in duration-150'
export const motionOverlayOut = 'animate-out fade-out duration-150'
export const motionPanelIn = 'animate-in fade-in zoom-in-95 duration-200 ease-out'
export const motionPanelOut = 'animate-out fade-out zoom-out-95 duration-150 ease-in'
export const motionDrawerIn = 'animate-in fade-in slide-in-from-right-4 duration-200 ease-out'
export const motionDrawerOut = 'animate-out fade-out slide-out-to-right-4 duration-150 ease-in'
export const motionToastIn = 'animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out'
export const motionToastOut = 'animate-out fade-out slide-out-to-bottom-2 duration-150 ease-in'
export const motionPopoverIn = 'glass-animate-in'
export const motionContentCrossfade = 'transition-opacity duration-200 ease-out'

/** Liste: nach links ausgleiten (rechts → links), dabei ausblenden. */
export const motionListItemExit =
  'pointer-events-none overflow-hidden opacity-0 -translate-x-3 scale-[0.98] transition-[opacity,transform] duration-150 ease-in'

/** Aufgaben-Checkbox: kurzer Pop beim Abhaken. */
export const motionTaskCheckPop = 'animate-in zoom-in-50 duration-200 ease-out'

/** Neue Aufgabenzeile (optimistisch): sanft einblenden. */
export const motionListItemEnter = 'animate-in fade-in slide-in-from-top-1 duration-200 ease-out'
