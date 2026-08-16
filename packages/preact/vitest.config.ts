import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [preact()],
  test: {
    sequence: { groupOrder: 17 },
    testTimeout: 5000,
    name: '@reatom/preact',
    include: ['./src/**/*.test.ts', './src/**/*.test-d.tsx'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
      include: ['./src/**/*.test-d.tsx'],
      ignoreSourceErrors: true,
    },
  },
})
