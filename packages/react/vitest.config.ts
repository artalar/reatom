import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'react',
          sequence: { groupOrder: 14 },
          testTimeout: 5000,
          include: ['./src/**/*.test.tsx'],
          exclude: [...configDefaults.exclude, './src/**/*.react18.test.tsx'],
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
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            'react-dom': 'react-dom-18',
            react: 'react-18',
          },
        },
        test: {
          name: 'react18',
          sequence: { groupOrder: 14 },
          testTimeout: 5000,
          include: ['./src/**/*.react18.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [
              {
                name: 'react18-chromium',
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
})
