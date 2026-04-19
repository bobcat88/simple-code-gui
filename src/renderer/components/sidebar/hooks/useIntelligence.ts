import { useState, useEffect } from 'react'
import { getApi, ProjectIntelligence } from '../../../api/index.js'

export function useIntelligence(projectPath: string | null) {
  const [intelligence, setIntelligence] = useState<ProjectIntelligence | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) {
      setIntelligence(null)
      return
    }

    const api = getApi()
    if (!api) return

    let isMounted = true
    setLoading(true)
    setError(null)

    api.getProjectIntelligence(projectPath)
      .then((data) => {
        if (isMounted) {
          setIntelligence(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to fetch project intelligence:', err)
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [projectPath])

  return { intelligence, loading, error }
}
