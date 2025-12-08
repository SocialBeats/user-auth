import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import {
  requireRoles,
  requireAdmin,
  requireBeatmaker,
} from '../../../src/middlewares/roleMiddleware.js';

// Mock Express req/res/next
const mockRequest = (user = null) => ({
  user,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockNext = vi.fn();

describe('RoleMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireRoles', () => {
    it('should call next() for user with required role', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'admin', roles: ['admin'] });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of multiple allowed roles', () => {
      const middleware = requireRoles(['admin', 'moderator']);
      const req = mockRequest({ username: 'mod', roles: ['moderator'] });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when user has multiple roles including required', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({
        username: 'poweruser',
        roles: ['beatmaker', 'admin'],
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest(null);
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AUTHENTICATION_REQUIRED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no roles', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'noroles', roles: null });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NO_ROLES_ASSIGNED',
        })
      );
    });

    it('should return 403 when user roles is undefined', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'noroles' }); // roles undefined
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when user lacks required role', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'user', roles: ['beatmaker'] });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INSUFFICIENT_PERMISSIONS',
          required: ['admin'],
          current: ['beatmaker'],
        })
      );
    });

    it('should handle roles as comma-separated string', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'user', roles: 'beatmaker, admin' });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 for invalid roles format (not array or string)', () => {
      const middleware = requireRoles(['admin']);
      const req = mockRequest({ username: 'user', roles: 123 });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin access', () => {
      const req = mockRequest({ username: 'admin', roles: ['admin'] });
      const res = mockResponse();

      requireAdmin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny beatmaker access', () => {
      const req = mockRequest({ username: 'user', roles: ['beatmaker'] });
      const res = mockResponse();

      requireAdmin(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireBeatmaker', () => {
    it('should allow beatmaker access', () => {
      const req = mockRequest({ username: 'user', roles: ['beatmaker'] });
      const res = mockResponse();

      requireBeatmaker(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny admin-only access', () => {
      const req = mockRequest({ username: 'admin', roles: ['admin'] });
      const res = mockResponse();

      requireBeatmaker(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
