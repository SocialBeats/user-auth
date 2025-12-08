import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/services/tokenService.js', () => ({
  validateAccessTokenRedisOnly: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import * as tokenValidationController from '../../../src/controllers/tokenValidationController.js';
import * as tokenService from '../../../src/services/tokenService.js';

// Mock Express req/res
const mockRequest = (body = {}) => ({
  body,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('TokenValidationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const mockTokenData = {
        id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        roles: ['beatmaker'],
      };
      const req = mockRequest({ token: 'valid-token' });
      const res = mockResponse();

      tokenService.validateAccessTokenRedisOnly.mockResolvedValue(
        mockTokenData
      );

      await tokenValidationController.validateToken(req, res);

      expect(tokenService.validateAccessTokenRedisOnly).toHaveBeenCalledWith(
        'valid-token'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@test.com',
          roles: ['beatmaker'],
        },
      });
    });

    it('should return 400 if token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await tokenValidationController.validateToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        error: 'MISSING_TOKEN',
        message: 'Token is required',
      });
    });

    it('should return invalid response if token not in Redis', async () => {
      const req = mockRequest({ token: 'invalid-token' });
      const res = mockResponse();

      tokenService.validateAccessTokenRedisOnly.mockResolvedValue(null);

      await tokenValidationController.validateToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or has been revoked',
      });
    });

    it('should return 500 on service error', async () => {
      const req = mockRequest({ token: 'some-token' });
      const res = mockResponse();

      tokenService.validateAccessTokenRedisOnly.mockRejectedValue(
        new Error('Redis error')
      );

      await tokenValidationController.validateToken(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        error: 'VALIDATION_FAILED',
        message: 'Token validation failed',
      });
    });

    it('should validate token with admin roles', async () => {
      const mockTokenData = {
        id: 'admin-id',
        username: 'admin',
        email: 'admin@test.com',
        roles: ['admin'],
      };
      const req = mockRequest({ token: 'admin-token' });
      const res = mockResponse();

      tokenService.validateAccessTokenRedisOnly.mockResolvedValue(
        mockTokenData
      );

      await tokenValidationController.validateToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        user: {
          id: 'admin-id',
          username: 'admin',
          email: 'admin@test.com',
          roles: ['admin'],
        },
      });
    });

    it('should handle token with multiple roles', async () => {
      const mockTokenData = {
        id: 'user-id',
        username: 'poweruser',
        email: 'power@test.com',
        roles: ['beatmaker', 'admin'],
      };
      const req = mockRequest({ token: 'power-token' });
      const res = mockResponse();

      tokenService.validateAccessTokenRedisOnly.mockResolvedValue(
        mockTokenData
      );

      await tokenValidationController.validateToken(req, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        user: expect.objectContaining({
          roles: ['beatmaker', 'admin'],
        }),
      });
    });
  });
});
