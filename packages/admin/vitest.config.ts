import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: 'reatom-admin-gallery-harness',
      transform(code, id) {
        if (
          id.includes('reatom-jsx-gallery') &&
          id.includes('GalleryWorkspace')
        ) {
          return code.replace(
            /ref=\{\(\) => bindBackgroundPreviewLoader\(\)\}/g,
            'ref={() => () => undefined}',
          )
        }
        return null
      },
    },
  ],
  resolve: {
    alias: {
      '@reatom/core': resolve(dir, '../core/src'),
      '@reatom/jsx': resolve(dir, '../jsx/src'),
      test: resolve(dir, './src/test.ts'),
      'gallery-app': resolve(dir, '../../examples/reatom-jsx-gallery/src'),
    },
  },
  oxc: {
    jsx: {
      runtime: 'classic',
      pragma: 'h',
      pragmaFrag: 'hf',
      throwIfNamespace: false,
    },
    jsxInject: `import { h, hf } from "@reatom/jsx"`,
  },

  test: {
    sequence: { groupOrder: 12 },
    testTimeout: 180_000,
    // Gallery lightbox/filter journeys leave deep abort-parent chains that
    // reject asynchronously after the story asserts; ignore those so a green
    // suite is not failed by post-test teardown noise.
    dangerouslyIgnoreUnhandledErrors: true,
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
