import type { AiConnectionsProvider } from '@shared/ai-connections'
import { completeJsonWithGemini } from './gemini-provider'
import { completeJsonWithOpenAi } from './openai-provider'

export interface AiJsonCompletionInput {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
}

export async function completeJson(
  provider: AiConnectionsProvider,
  input: AiJsonCompletionInput
): Promise<unknown> {
  if (provider === 'openai') {
    return completeJsonWithOpenAi(input)
  }
  return completeJsonWithGemini(input)
}
