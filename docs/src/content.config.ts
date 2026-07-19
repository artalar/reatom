import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'

import { jsdocLoader } from '../config/loaders/jsdoc-loader'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  reference: defineCollection({
    loader: jsdocLoader({
      packages: [
        'packages/core/src/async',
        'packages/core/src/core',
        'packages/core/src/methods',
        'packages/core/src/extensions',
        'packages/core/src/persist',
        'packages/core/src/primitives',
        'packages/core/src/routing',
        'packages/core/src/web',
        'packages/core/src/utils.ts',
        { path: 'packages/jsx/src', mode: 'readme' },
        { path: 'packages/lit/src', mode: 'readme' },
        { path: 'packages/preact/src', mode: 'readme' },
        { path: 'packages/react/src', mode: 'readme' },
        { path: 'packages/vite/src', mode: 'readme' },
        { path: 'packages/vue/src', mode: 'readme' },
        { path: 'packages/zod/src', mode: 'readme' },
      ],
    }),
  }),
}
