import { Router, Request, Response } from 'express'
import { getAiRuntime } from '../ai/runtime'
import { AiChatRequest } from '../ai/types'

const router = Router()

/**
 * @route POST /api/ai/chat
 * @desc Send a chat request to the AI runtime
 */
router.post('/chat', async (req: Request, res: Response) => {
  const chatRequest: AiChatRequest = req.body
  const runtime = getAiRuntime()
  
  if (chatRequest.options?.stream) {
    // Handle streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    try {
      const stream = runtime.streamChat(chatRequest)
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
      res.end()
    }
  } else {
    // Regular completion
    const response = await runtime.chat(chatRequest)
    res.json(response)
  }
})

/**
 * @route GET /api/ai/providers
 * @desc List available AI providers
 */
router.get('/providers', (req: Request, res: Response) => {
  // Simple list for now
  res.json({
    success: true,
    data: [
      { id: 'claude', name: 'Anthropic Claude', enabled: false },
      { id: 'openai', name: 'OpenAI GPT', enabled: false },
      { id: 'gemini', name: 'Google Gemini', enabled: false },
      { id: 'ollama', name: 'Ollama (Local)', enabled: true }
    ],
    timestamp: Date.now()
  })
})

export default router
