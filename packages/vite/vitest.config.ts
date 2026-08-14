/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    sequence: { groupOrder: 20 },
    testTimeout: 5000,
    include: ['./src/**/*.test.ts'],
  },
})
