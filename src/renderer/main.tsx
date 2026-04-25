import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles.css'
import './index.css'
import './modernize.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Suppress Vite dev server reconnection errors (expected when dev server stops)
if (import.meta.env.DEV) {
  const originalError = console.error
  console.error = (...args) => {
    const msg = args[0]?.toString?.() || ''
    // Filter out Vite reconnection spam
    if (msg.includes('net::ERR_CONNECTION_REFUSED') ||
        msg.includes('[vite]') ||
        msg.includes('localhost:5173')) {
      return
    }
    originalError.apply(console, args)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary componentName="Application">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
