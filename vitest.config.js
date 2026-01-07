import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      all: true,
      reportsDirectory: path.resolve('./coverage'),
      include: ['src/**/*.js'],
      exclude: [
        'src/config/s3.js', // AWS S3 config - external dependency
        'src/config/redis.js', // Redis config - tested via integration
        'src/routes/*Routes.js', // Routes are tested via integration tests
        'src/utils/initAdmin.js', // Initialization script
        'src/utils/versionUtils.js', // Version utilities - simple static data
        'src/utils/spaceConnection.js', // Space connection - tested via integration
        'src/db.js', // Database connection - tested via integration
        'src/models/**', // Models - tested via integration (Mongoose schemas)
        'node_modules/**',
        'tests/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
