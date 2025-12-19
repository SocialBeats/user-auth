import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tokenService
vi.mock('../../../src/services/tokenService.js', () => ({
  validateAccessToken: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import verifyToken from '../../../src/middlewares/authMiddlewares.js';
import * as tokenService from '../../../src/services/tokenService.js';

// Mock Express req/res/next
const mockRequest = (path, headers = {}) => ({
  path,
  headers,
  body: {},
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockNext = vi.fn();

describe('AuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Open paths (no authentication required)', () => {
    const openPaths = [
      '/api/v1/docs/',
      '/api/v1/docs/swagger',
      '/api/v1/health',
      '/api/v1/about',
      '/api/v1/changelog',
      '/api/v1/version',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/validate-token',
    ];

    openPaths.forEach((path) => {
      it(`should skip authentication for ${path}`, async () => {
        const req = mockRequest(path);
        const res = mockResponse();

        await verifyToken(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('API version validation', () => {
    it('should return 400 for paths without API version', async () => {
      const req = mockRequest('/some/path');
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'You must specify the API version, e.g. /api/v1/...',
      });
    });
  });

  describe('Gateway authentication', () => {
    it('should authenticate via gateway headers', async () => {
      const req = mockRequest('/api/v1/protected', {
        'x-gateway-authenticated': 'true',
        'x-user-id': 'user123',
        'x-username': 'testuser',
        'x-roles': 'beatmaker,admin',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'user123',
        username: 'testuser',
        roles: ['beatmaker', 'admin'],
      });
    });

    it('should use userId as username if x-username not provided', async () => {
      const req = mockRequest('/api/v1/protected', {
        'x-gateway-authenticated': 'true',
        'x-user-id': 'user123',
        'x-roles': 'beatmaker',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(req.user.username).toBe('user123');
    });

    it('should handle empty roles from gateway', async () => {
      const req = mockRequest('/api/v1/protected', {
        'x-gateway-authenticated': 'true',
        'x-user-id': 'user123',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(req.user.roles).toEqual([]);
    });
  });

  describe('JWT token authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const mockTokenData = {
        id: 'user123',
        username: 'testuser',
        email: 'test@test.com',
        roles: ['beatmaker'],
      };

      tokenService.validateAccessToken.mockResolvedValue(mockTokenData);

      const req = mockRequest('/api/v1/protected', {
        authorization: 'Bearer valid-token',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(tokenService.validateAccessToken).toHaveBeenCalledWith(
        'valid-token'
      );
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toEqual(mockTokenData);
    });

    it('should return 401 when no token provided', async () => {
      const req = mockRequest('/api/v1/protected', {});
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'MISSING_TOKEN',
        message: 'Missing token',
      });
    });

    it('should return 403 when token is invalid', async () => {
      tokenService.validateAccessToken.mockResolvedValue(null);

      const req = mockRequest('/api/v1/protected', {
        authorization: 'Bearer invalid-token',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'TOKEN_EXPIRED_OR_INVALID',
        message: 'Invalid or expired token',
      });
    });
  });

  describe('Priority: Gateway vs JWT', () => {
    it('should prioritize gateway headers over JWT token', async () => {
      const req = mockRequest('/api/v1/protected', {
        'x-gateway-authenticated': 'true',
        'x-user-id': 'gateway-user',
        'x-username': 'gateway-username',
        'x-roles': 'admin',
        authorization: 'Bearer some-jwt-token',
      });
      const res = mockResponse();

      await verifyToken(req, res, mockNext);

      expect(req.user.id).toBe('gateway-user');
      expect(req.user.username).toBe('gateway-username');
      expect(tokenService.validateAccessToken).not.toHaveBeenCalled();
    });
  });
});
