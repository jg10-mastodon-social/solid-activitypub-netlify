import { defineConfig } from 'vitest/config'
import { defineVitestConfig } from '@stencil/vitest/config'

export default defineConfig({
  test: {
    hookTimeout: 60000,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          setupFiles: ['./tests/helpers/dev-server-setup.ts'],
          hookTimeout: 60000,
          threads: true,
          singleThread: true,
        },
      },
      defineVitestConfig({
        test: {
          name: 'ui',
          include: ['static-ui/templates/**/*.spec.tsx'],
          environment: 'stencil',
          setupFiles: ['./tests/ui-setup.ts'],
          environmentOptions: { stencil: { domEnvironment: 'happy-dom' } },
        },
      }),
    ],
  },
})