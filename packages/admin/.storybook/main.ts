import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/html-vite'
import type { InlineConfig } from 'vite'

const dir = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: '@storybook/html-vite',
  async viteFinal(config: InlineConfig) {
    const { mergeConfig } = await import('vite')
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@reatom/core': resolve(dir, '../../core/src'),
          '@reatom/jsx': resolve(dir, '../../jsx/src'),
          test: resolve(dir, '../src/test.ts'),
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
