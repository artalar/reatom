import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'classic',
      pragma: 'h',
      pragmaFrag: 'hf',
      throwIfNamespace: false,
      development: false,
    },
  },
  test: {
    name: '@reatom/jsx-bench',
    include: [],
    benchmark: {
      include: ['./src/jsx.bench.tsx'],
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          name: 'jsx-bench-chromium',
          browser: 'chromium',
        },
      ],
    },
  },
})
