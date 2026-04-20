import { AiCompletionOptions, AiCompletionResponse, AiMessage, AiProvider, AiProviderType } from '../types'

export class MockProvider implements AiProvider {
  type: AiProviderType = 'ollama' // Mocking as ollama for local feel
  name: string = 'Mock Provider'

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const lastMessage = messages[messages.length - 1]?.content || ''
    return {
      id: `mock-${Date.now()}`,
      content: `This is a mock response to: "${lastMessage}"`,
      model: options?.model || 'mock-model',
      usage: {
        promptTokens: lastMessage.length,
        completionTokens: 20,
        totalTokens: lastMessage.length + 20
      }
    }
  }

  async *streamComplete(messages: AiMessage[], options?: AiCompletionOptions): AsyncIterable<string> {
    const response = `This is a mocked streaming response for: ${messages[messages.length - 1]?.content}`
    const words = response.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}
