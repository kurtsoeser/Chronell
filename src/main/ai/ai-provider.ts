import type { AiConnectionsProvider } from '@shared/ai-connections'
import { completeJsonWithGemini, completeTextWithGemini } from './gemini-provider'
import { completeJsonWithOpenAi, completeTextWithOpenAi, type AiChatMessage } from './openai-provider'
import { completeJsonWithOllama, completeTextWithOllama } from './ollama-provider'

export type { AiChatMessage }

export interface AiJsonCompletionInput {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  ollamaBaseUrl?: string
}

export interface AiTextCompletionInput {
  apiKey: string
  model: string
  messages: AiChatMessage[]
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

export async function completeText(
  provider: AiConnectionsProvider,
  input: AiTextCompletionInput
): Promise<string> {
  if (provider === 'ollama') {
    if (!input.ollamaBaseUrl?.trim()) {
      throw new Error('Ollama-Basis-URL fehlt.')
    }
    return completeTextWithOllama({
      baseUrl: input.ollamaBaseUrl,
      model: input.model,
      messages: input.messages
    })
  }
  if (provider === 'openai') {
    return completeTextWithOpenAi({
      apiKey: input.apiKey,
      model: input.model,
      messages: input.messages
    })
  }
  return completeTextWithGemini({
    apiKey: input.apiKey,
    model: input.model,
    messages: input.messages
  })
}
