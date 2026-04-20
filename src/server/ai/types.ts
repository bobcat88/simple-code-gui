import { ApiResponse } from '../types'

export type AiProviderType = 'claude' | 'openai' | 'gemini' | 'ollama'

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  stop?: string[]
}

export interface AiCompletionResponse {
  id: string
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AiProvider {
  type: AiProviderType
  name: string
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResponse>
  streamComplete(messages: AiMessage[], options?: AiCompletionOptions): AsyncIterable<string>
}

export interface AiRuntimeConfig {
  defaultProvider: AiProviderType
  providers: {
    [key in AiProviderType]?: {
      apiKey?: string
      baseUrl?: string
      defaultModel?: string
      enabled: boolean
    }
  }
}

export interface AiChatRequest {
  messages: AiMessage[]
  provider?: AiProviderType
  options?: AiCompletionOptions
}

export type AiChatResponse = ApiResponse<AiCompletionResponse>
