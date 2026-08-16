import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    sequence: { groupOrder: 14 },
    testTimeout: 5000,
    include: ['./src/**/*.test.tsx', './src/**/*.test-d.tsx'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
      include: ['./src/**/*.test-d.tsx'],
      ignoreSourceErrors: true,
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          name: 'react-chromium',
          browser: 'chromium',
        },
      ],
    },
  },
})
