import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx,js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    },
    testTimeout: 20000,
    hookTimeout: 20000
  }
})
