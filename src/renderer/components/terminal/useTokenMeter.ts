import { useCallback, useRef } from 'react'
import type { BackendId, ExtendedApi } from '../../api/types'
import {
  TOKEN_METRIC_REGEX,
  TOKEN_SAVED_REGEX,
  TOKEN_COST_REGEX
} from './constants.js'

interface UseTokenMeterOptions {
  ptyId: string
  api: any
  projectPath?: string
  backend?: 'default' | BackendId
}

interface UseTokenMeterReturn {
  processTokenChunk: (cleanChunk: string) => void
}

/**
 * Hook for capturing token usage metrics from terminal output and logging them to the database.
 */
export function useTokenMeter({ ptyId, api, projectPath, backend }: UseTokenMeterOptions): UseTokenMeterReturn {
  const bufferRef = useRef('')
  const lastLoggedRef = useRef<string | null>(null)

  const processTokenChunk = useCallback((cleanChunk: string) => {
    bufferRef.current += cleanChunk
    
    // Check for token metrics
    const metricMatch = bufferRef.current.match(TOKEN_METRIC_REGEX)
    const savedMatch = bufferRef.current.match(TOKEN_SAVED_REGEX)
    const costMatch = bufferRef.current.match(TOKEN_COST_REGEX)

    if (metricMatch) {
      const inputTokens = parseInt(metricMatch[1].replace(/,/g, ''), 10)
      const outputTokens = parseInt(metricMatch[2].replace(/,/g, ''), 10)
      const savedTokens = savedMatch ? parseInt(savedMatch[1].replace(/,/g, ''), 10) : 0
      const costEst = costMatch ? parseFloat(costMatch[1]) : 0

      // Use the full match as a unique key to prevent double-logging the same line
      const logKey = `${metricMatch[0]}-${savedTokens}-${costEst}`
      
      if (lastLoggedRef.current !== logKey) {
        lastLoggedRef.current = logKey
        
        // Log to database
        if ((api as ExtendedApi)?.logTokenEvent) {
          (api as ExtendedApi).logTokenEvent(
            {
              sessionId: ptyId,
              projectPath: projectPath || 'unknown',
              backend: !backend || backend === 'default' ? 'claude' : backend,
              inputTokens,
              outputTokens,
              costEstimate: costEst,
            },
            savedTokens
          ).catch(err => console.error('Failed to log token event:', err))
        }
      }
    }

    // Keep buffer manageable
    if (bufferRef.current.length > 5000) {
      bufferRef.current = bufferRef.current.substring(bufferRef.current.length - 2000)
    }
  }, [api, backend, projectPath, ptyId])

  return {
    processTokenChunk
  }
}
