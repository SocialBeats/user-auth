import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing
vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { requireInternalApiKey } from '../../../src/middlewares/internalMiddleware.js';
import logger from '../../../logger.js';

// Mock Express req/res/next
const mockRequest = (headers = {}, ip = '127.0.0.1') => ({
  headers,
  ip,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('InternalMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireInternalApiKey', () => {
    it('should return 500 if INTERNAL_API_KEY is not configured', () => {
      delete process.env.INTERNAL_API_KEY;

      const req = mockRequest({ 'x-internal-api-key': 'some-key' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CONFIGURATION_ERROR',
        message: 'Error de configuración en la autenticación interna',
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'INTERNAL_API_KEY no está configurada en el entorno'
      );
    });

    it('should return 401 if API key is not provided', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({}); // No header
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'API key interna inválida o no proporcionada',
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return 401 if API key is invalid', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({ 'x-internal-api-key': 'wrong-key' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'API key interna inválida o no proporcionada',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if API key is valid', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({ 'x-internal-api-key': 'valid-api-key' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Acceso interno autorizado correctamente'
      );
    });

    it('should log warning with masked key on failed attempt', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest(
        { 'x-internal-api-key': 'wrong-key' },
        '192.168.1.1'
      );
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1')
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('***'));
    });

    it('should log warning with "missing" when no key provided', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({}, '10.0.0.1');
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing')
      );
    });

    it('should handle empty string API key as invalid', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({ 'x-internal-api-key': '' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle whitespace API key as invalid', () => {
      process.env.INTERNAL_API_KEY = 'valid-api-key';

      const req = mockRequest({ 'x-internal-api-key': '   ' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should be case-sensitive for API key comparison', () => {
      process.env.INTERNAL_API_KEY = 'Valid-API-Key';

      const req = mockRequest({ 'x-internal-api-key': 'valid-api-key' });
      const res = mockResponse();
      const next = vi.fn();

      requireInternalApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
