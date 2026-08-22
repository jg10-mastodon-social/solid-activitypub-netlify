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
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
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
  {
    extends: './vitest.config.ts',
    test: {
      name: 'ui',
      include: ['static-ui/templates/**/*.spec.tsx'],
      environment: 'stencil',
      setupFiles: ['./tests/ui-setup.ts'],
      environmentOptions: { stencil: { domEnvironment: 'happy-dom' } },
    },
  },
]