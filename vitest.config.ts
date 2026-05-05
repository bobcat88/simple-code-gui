import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

process.env.NODE_ENV = 'test'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.kspec-worktrees', '.worktrees'],
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 45,
        functions: 60,
        lines: 60,
        'src/renderer/api/http-backend/**/*.ts': {
          statements: 65,
          branches: 50,
          functions: 45,
          lines: 65,
        },
        'src/renderer/api/httpClient/**/*.ts': {
          statements: 55,
          branches: 50,
          functions: 30,
          lines: 55,
        },
        'src/renderer/api/httpClient/websocket-manager.ts': {
          statements: 85,
          branches: 65,
          functions: 75,
          lines: 88,
        },
        'src/renderer/components/intelligence/**/*.{ts,tsx}': {
          statements: 50,
          branches: 40,
          functions: 40,
          lines: 50,
        },
        'src/renderer/components/orchestration/**/*.tsx': {
          statements: 70,
          branches: 65,
          functions: 75,
          lines: 70,
        },
      },
    },
  },
})
