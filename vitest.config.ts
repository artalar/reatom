import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      './packages/core/vitest.config.ts',
      './packages/core/vitest.browser.config.ts',
      './packages/admin/vitest.config.ts',
      './packages/jsx/vitest.config.ts',
      './packages/react/vitest.config.ts',
      './packages/zod/vitest.config.ts',
      './packages/lit/vitest.config.ts',
      './packages/preact/vitest.config.ts',
      './packages/preact/vitest.browser.config.ts',
      './packages/solid-js/vitest.browser.config.ts',
      './packages/vue/vitest.config.ts',
      './packages/ux/vitest.config.ts',
      './packages/ux/vitest.browser.config.ts',
    ],
  },
})

