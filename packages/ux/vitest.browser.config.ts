import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    sequence: { groupOrder: 21 },
    testTimeout: 5000,
    name: '@reatom/ux-browser',
    include: ['./src/**/*.test.browser.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          name: 'ux-chromium',
          browser: 'chromium',
        },
      ],
    },
  },
})
