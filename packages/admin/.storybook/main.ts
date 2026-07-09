import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/html-vite'
import type { InlineConfig } from 'vite'

const dir = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: [
    '../src/stories/admin-shell/**/*.stories.@(ts|tsx)',
    '../src/stories/reatom-jsx-xo/**/*.stories.@(ts|tsx)',
    // Only the admin harness stories — not the example app's own suites under src/
    '../src/stories/reatom-jsx-gallery/*.stories.@(ts|tsx)',
  ],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: '@storybook/html-vite',
  async viteFinal(config: InlineConfig) {
    const { mergeConfig } = await import('vite')
    return mergeConfig(config, {
      plugins: [
        {
          name: 'reatom-admin-gallery-harness',
          transform(code: string, id: string) {
            // Empty mock blobs + background thumbnail scanning create deep
            // abort chains under Vitest. Disable the loader in the harness.
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
          '@reatom/core': resolve(dir, '../../core/src'),
          '@reatom/jsx': resolve(dir, '../../jsx/src'),
          test: resolve(dir, '../src/test.ts'),
          'gallery-app': resolve(
            dir,
            '../../../examples/reatom-jsx-gallery/src',
          ),
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
    })
  },
}

export default config
