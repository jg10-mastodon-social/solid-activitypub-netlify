import { defineConfig } from 'vitest/config'

export default [
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'e2e',
      include: ['tests/e2e/**/*.test.ts'],
      setupFiles: ['./tests/helpers/dev-server-setup.ts'],
      hookTimeout: 60000,
      threads: true,
      singleThread: true,
    },
  },
]
