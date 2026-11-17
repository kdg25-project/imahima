import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  test: { include: ['worker/**/*.test.ts', 'src/**/*.test.{ts,tsx}'] },
})
