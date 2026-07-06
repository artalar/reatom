import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@reatom/core': resolve(dir, '../core/src'),
      '@reatom/jsx': resolve(dir, '../jsx/src'),
      test: resolve(dir, './src/test.ts'),
    },
  },
  oxc: {
    jsx: {
      runtime: 'classic',
      pragma: 'h',
      pragmaFrag: 'hf',
    },
    jsxInject: `import { h, hf } from "@reatom/jsx"`,
  },

  test: {
    sequence: { groupOrder: 12 },
    testTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: '@reatom/admin',
          include: ['./src/**/*.test.ts'],
          exclude: ['./src/**/*.test.browser.ts', './src/stories/**'],
          isolate: false,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: resolve(dir, '.storybook'),
            storybookScript: 'pnpm storybook --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: [resolve(dir, '.storybook/vitest.setup.ts')],
        },
      },
    ],
  },
})
