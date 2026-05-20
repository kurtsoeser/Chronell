import type { AiConnectionsProvider } from './ai-connections'

export type AiPromptTier = 'full' | 'compact'

/** Kleine/lokale Ollama-Modelle: kürzere Prompts und weniger Kandidaten. */
export function isCompactOllamaModel(model: string): boolean {
  const m = model.trim().toLowerCase()
  if (!m) return false

  const paramB = m.match(/:(\d+(?:\.\d+)?)b\b/)
  if (paramB) {
    const billions = Number.parseFloat(paramB[1]!)
    if (Number.isFinite(billions) && billions <= 12) return true
  }

  const compactHints = [
    'phi3',
    'phi4',
    'gemma2',
    'gemma3:1b',
    'gemma3:4b',
    'smollm',
    'tinyllama',
    'llama3.2',
    'llama3.1:8b',
    'qwen2.5:7b',
    'qwen2.5:3b',
    'qwen2:7b',
    'mistral:7b',
    'mistral-nemo',
    'ministral'
  ]
  return compactHints.some((hint) => m.includes(hint))
}

export function resolveAiPromptTier(
  provider: AiConnectionsProvider,
  model: string
): AiPromptTier {
  if (provider !== 'ollama') return 'full'
  return isCompactOllamaModel(model) ? 'compact' : 'full'
}

export function effectiveMaxCandidatesForTier(
  tier: AiPromptTier,
  maxCandidates: number
): number {
  const cap = Math.min(Math.max(maxCandidates, 10), 50)
  if (tier === 'compact') return Math.min(cap, 12)
  return cap
}

export function effectiveMaxQualityLinksForTier(tier: AiPromptTier): number {
  return tier === 'compact' ? 6 : 12
}
