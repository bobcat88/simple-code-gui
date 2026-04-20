import { 
  AiChatRequest, 
  AiChatResponse, 
  AiProvider, 
  AiProviderType, 
  AiRuntimeConfig 
} from './types'
import { MockProvider } from './providers/mock'
import { GeminiProvider } from './providers/gemini'

export class AiRuntime {
  private providers: Map<AiProviderType, AiProvider> = new Map()
  private config: AiRuntimeConfig

  constructor(config: AiRuntimeConfig) {
    this.config = config
    this.initializeProviders()
  }

  private initializeProviders() {
    // For now, always add a mock provider if no real ones are enabled
    this.providers.set('ollama', new MockProvider())
    
    // Initialize Gemini if config is provided
    if (this.config.providers.gemini?.enabled) {
      this.providers.set('gemini', new GeminiProvider(this.config.providers.gemini))
    }
  }

  public getProvider(type?: AiProviderType): AiProvider {
    const providerType = type || this.config.defaultProvider
    const provider = this.providers.get(providerType)
    
    if (!provider) {
      // Fallback to first available provider
      const first = this.providers.values().next().value
      if (!first) throw new Error('No AI providers available')
      return first
    }
    
    return provider
  }

  public async chat(request: AiChatRequest): Promise<AiChatResponse> {
    try {
      const provider = this.getProvider(request.provider)
      const result = await provider.complete(request.messages, request.options)
      
      return {
        success: true,
        data: result,
        timestamp: Date.now()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown AI error',
        timestamp: Date.now()
      }
    }
  }

  public streamChat(request: AiChatRequest): AsyncIterable<string> {
    const provider = this.getProvider(request.provider)
    return provider.streamComplete(request.messages, request.options)
  }
}

// Default configuration
export const defaultAiConfig: AiRuntimeConfig = {
  defaultProvider: 'ollama',
  providers: {
    ollama: { enabled: true }
  }
}

// Global instance for the server
let runtimeInstance: AiRuntime | null = null

export function getAiRuntime(config?: AiRuntimeConfig): AiRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new AiRuntime(config || defaultAiConfig)
  }
  return runtimeInstance
}
