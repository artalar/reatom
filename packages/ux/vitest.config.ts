import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    sequence: { groupOrder: 20 },
    testTimeout: 5000,
    name: '@reatom/ux',
    include: [
      './src/**/*.test.ts',
      './src/**/*.test-d.ts',
      './spike/**/*.test.ts',
    ],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
      include: ['./src/**/*.test-d.ts'],
      ignoreSourceErrors: true,
      allowJs: false,
    },
  },
})
