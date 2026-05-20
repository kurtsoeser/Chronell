const SESSION_SKIP_ASK_KEY = 'chronell.aiSnippet.skipAskSession'

export function isAiSnippetAskSkippedForSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SKIP_ASK_KEY) === '1'
  } catch {
    return false
  }
}

export function setAiSnippetAskSkippedForSession(skip: boolean): void {
  try {
    if (skip) sessionStorage.setItem(SESSION_SKIP_ASK_KEY, '1')
    else sessionStorage.removeItem(SESSION_SKIP_ASK_KEY)
  } catch {
    /* ignore */
  }
}
