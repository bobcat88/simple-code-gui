import { describe, it, expect, beforeEach } from 'vitest'
import { getAiRuntime } from '../../server/ai/runtime'
import { AiChatRequest } from '../../server/ai/types'

describe('AiRuntime', () => {
  beforeEach(() => {
    // Reset instance if needed (singleton)
  })

  it('should list available providers', () => {
    const runtime = getAiRuntime()
    const provider = runtime.getProvider('ollama')
    expect(provider).toBeDefined()
    expect(provider.type).toBe('ollama')
  })

  it('should handle simple chat requests', async () => {
    const runtime = getAiRuntime()
    const request: AiChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      provider: 'ollama'
    }
    
    const response = await runtime.chat(request)
    expect(response.success).toBe(true)
    expect(response.data?.content).toContain('Hello')
  })

  it('should handle streaming requests', async () => {
    const runtime = getAiRuntime()
    const request: AiChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      provider: 'ollama'
    }
    
    const chunks: string[] = []
    const stream = runtime.streamChat(request)
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toContain('Hello')
  })
})
