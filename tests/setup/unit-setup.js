// Unit test setup - no database or Redis connections
import { vi, beforeEach } from 'vitest';

// Mock process.exit to prevent test runner from exiting
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn((code) => {
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }),
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
