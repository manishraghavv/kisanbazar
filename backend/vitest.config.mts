import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Pure unit tests: no database, no env setup.
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        // Integration tests run the real Express app against a real Postgres (see tests/globalSetup.ts).
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/globalSetup.ts'],
          setupFiles: ['tests/setupEnv.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
