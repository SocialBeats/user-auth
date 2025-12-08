import { describe, it, expect, beforeEach } from 'vitest';
import { api, cleanupDatabase, cleanupRedis } from '../setup/setup.js';

describe('Health API Integration Tests', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 and the health payload', async () => {
      const res = await api.get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('message', 'Health check successful');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('db', 'connected');
    });

    it('should include all required health fields', async () => {
      const res = await api.get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(typeof res.body.version).toBe('string');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('GET /api/v1/about', () => {
    it('should return about information', async () => {
      const res = await api.get('/api/v1/about');

      expect(res.status).toBe(200);
      // About endpoint should be accessible without auth
    });
  });

  describe('GET /api/v1/version', () => {
    it('should return version information', async () => {
      const res = await api.get('/api/v1/version');

      expect(res.status).toBe(200);
    });
  });
});
