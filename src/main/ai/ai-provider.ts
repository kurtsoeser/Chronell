import type { AiConnectionsProvider } from '@shared/ai-connections'
import { completeJsonWithGemini } from './gemini-provider'
import { completeJsonWithOpenAi } from './openai-provider'
import { completeJsonWithOllama } from './ollama-provider'

export interface AiJsonCompletionInput {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  ollamaBaseUrl?: string
}

export async function completeJson(
  provider: AiConnectionsProvider,
  input: AiJsonCompletionInput
): Promise<unknown> {
  if (provider === 'ollama') {
    if (!input.ollamaBaseUrl?.trim()) {
      throw new Error('Ollama-Basis-URL fehlt.')
    }
    return completeJsonWithOllama({
      baseUrl: input.ollamaBaseUrl,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt
    })
  }
  if (provider === 'openai') {
    return completeJsonWithOpenAi(input)
  }
  return completeJsonWithGemini(input)
}
