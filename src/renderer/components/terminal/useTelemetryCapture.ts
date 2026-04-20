import { useCallback, useRef } from 'react'
import { useTelemetryStore } from '../../stores/telemetry'

export interface UseTelemetryCaptureOptions {
  ptyId: string
  projectPath?: string
  backend?: string
}

/**
 * Hook to capture token consumption and cost telemetry from PTY data.
 */
export function useTelemetryCapture({ ptyId, projectPath, backend }: UseTelemetryCaptureOptions) {
  const addUsage = useTelemetryStore((state) => state.addUsage)
  
  const context = projectPath && backend ? { projectPath, backend } : undefined
  
  // Buffering incomplete lines to handle chunks
  const lineBufferRef = useRef('')

  const processTelemetryChunk = useCallback((chunk: string) => {
    // Append to buffer and split by lines
    lineBufferRef.current += chunk
    const lines = lineBufferRef.current.split(/\r?\n/)
    
    // Keep the last (potentially incomplete) line in buffer
    lineBufferRef.current = lines.pop() || ''

    for (const line of lines) {
      const cleanLine = line.trim()
      if (!cleanLine) continue

      // Regex patterns for various token/cost log formats (ordered from most specific to least)
      
      // 1. Aider specific format: "Tokens: 1,234 prompt, 567 completion, 1,801 total. Cost: $0.0123."
      const aiderMatch = cleanLine.match(/Tokens:\s*([\d,]+)\s*prompt,\s*([\d,]+)\s*completion,\s*([\d,]+)\s*total\.\s*Cost:\s*\$([\d.]+)/i)
      if (aiderMatch) {
        const prompt = parseInt(aiderMatch[1].replace(/,/g, ''), 10)
        const completion = parseInt(aiderMatch[2].replace(/,/g, ''), 10)
        const total = parseInt(aiderMatch[3].replace(/,/g, ''), 10)
        const cost = parseFloat(aiderMatch[4])
        addUsage(ptyId, { tokens: { prompt, completion, total }, cost }, context)
        continue
      }

      // 2. Tokens: 123 prompt, 456 completion, 579 total
      const tokenMatch = cleanLine.match(/Tokens:\s*([\d,]+)\s*prompt,\s*([\d,]+)\s*completion,\s*([\d,]+)\s*total/i)
      if (tokenMatch) {
        const prompt = parseInt(tokenMatch[1].replace(/,/g, ''), 10)
        const completion = parseInt(tokenMatch[2].replace(/,/g, ''), 10)
        const total = parseInt(tokenMatch[3].replace(/,/g, ''), 10)
        addUsage(ptyId, { tokens: { prompt, completion, total } }, context)
        continue
      }

      // 3. Simple Tokens: 123 (usually implies total)
      const simpleTokenMatch = cleanLine.match(/^Tokens:\s*([\d,]+)$/i)
      if (simpleTokenMatch) {
        const total = parseInt(simpleTokenMatch[1].replace(/,/g, ''), 10)
        addUsage(ptyId, { tokens: { prompt: 0, completion: 0, total } }, context)
        continue
      }

      // 4. Cost: $0.0123
      const costMatch = cleanLine.match(/Cost:\s*\$([\d.]+)/i)
      if (costMatch) {
        const cost = parseFloat(costMatch[1])
        addUsage(ptyId, { cost }, context)
        continue
      }

      // 5. Savings: $0.005 or Savings: 80%
      const savingsMatch = cleanLine.match(/Savings:\s*\$([\d.]+)/i)
      if (savingsMatch) {
        const savings = parseFloat(savingsMatch[1])
        addUsage(ptyId, { savings }, context)
        continue
      }

      // 6. Cache hits: 12
      const cacheHitMatch = cleanLine.match(/Cache\s*hits:\s*(\d+)/i)
      if (cacheHitMatch) {
        const cacheHits = parseInt(cacheHitMatch[1], 10)
        addUsage(ptyId, { cacheHits }, context)
        continue
      }

      // 7. RTK "Saved Tokens" pattern from rtk gain
      const rtkTokensMatch = cleanLine.match(/Saved\s+Tokens:\s*([\d,]+)/i)
      if (rtkTokensMatch) {
        const tokensSaved = parseInt(rtkTokensMatch[1].replace(/,/g, ''), 10)
        addUsage(ptyId, { tokensSaved }, context)
        continue
      }

      // 8. General "tokens saved" pattern
      const genSavedMatch = cleanLine.match(/([\d,]+)\s+tokens\s+saved/i)
      if (genSavedMatch) {
        const tokensSaved = parseInt(genSavedMatch[1].replace(/,/g, ''), 10)
        addUsage(ptyId, { tokensSaved }, context)
        continue
      }

      // 9. MCP specific savings
      const mcpSavingsMatch = cleanLine.match(/\[MCP\]\s+Savings:\s*([\d,]+)\s+tokens/i)
      if (mcpSavingsMatch) {
        const tokensSaved = parseInt(mcpSavingsMatch[1].replace(/,/g, ''), 10)
        addUsage(ptyId, { tokensSaved }, context)
        continue
      }
    }
  }, [ptyId, addUsage, context])

  return {
    processTelemetryChunk,
  }
}
