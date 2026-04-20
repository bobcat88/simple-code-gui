import { 
  AiCompletionOptions, 
  AiCompletionResponse, 
  AiMessage, 
  AiProvider, 
  AiProviderType 
} from '../types'

export interface GeminiConfig {
  apiKey?: string
  defaultModel?: string
}

export class GeminiProvider implements AiProvider {
  type: AiProviderType = 'gemini'
  name: string = 'Google Gemini'
  private apiKey: string
  private defaultModel: string

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
    this.defaultModel = config.defaultModel || 'gemini-pro'
  }

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    if (!this.apiKey) throw new Error('Gemini API key is missing')

    const model = options?.model || this.defaultModel
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      id: `gemini-${Date.now()}`,
      content,
      model,
      usage: {
        promptTokens: 0, // Gemini beta API doesn't return usage in simple call
        completionTokens: 0,
        totalTokens: 0
      }
    }
  }

  async *streamComplete(messages: AiMessage[], options?: AiCompletionOptions): AsyncIterable<string> {
    // Basic streaming implementation for Gemini beta API
    // (In a real app, use @google/generative-ai for robust SSE handling)
    if (!this.apiKey) throw new Error('Gemini API key is missing')

    const model = options?.model || this.defaultModel
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    })

    if (!response.ok) throw new Error(`Gemini Streaming Error: ${response.statusText}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get stream reader')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) yield text
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}
