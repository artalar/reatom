import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@reatom/ux',
    include: ['./spike/**/*.test.ts'],
  },
})
