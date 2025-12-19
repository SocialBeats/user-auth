import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/services/authService.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  refreshAccessToken: vi.fn(),
  logoutUser: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import * as authController from '../../../src/controllers/authController.js';
import * as authService from '../../../src/services/authService.js';

// Mock Express req/res
const mockRequest = (body = {}, user = null, params = {}) => ({
  body,
  user,
  params,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const req = mockRequest({
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      authService.registerUser.mockResolvedValue({
        _id: 'user-id',
        username: 'newuser',
      });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
      });
    });

    it('should return 400 if username is missing', async () => {
      const req = mockRequest({
        email: 'test@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if email is missing', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if password is missing', async () => {
      const req = mockRequest({
        username: 'testuser',
        email: 'test@test.com',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if fields are not strings', async () => {
      const req = mockRequest({
        username: 123,
        email: 'test@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_DATA_TYPE',
        })
      );
    });

    it('should return 400 if username is too short', async () => {
      const req = mockRequest({
        username: 'ab',
        email: 'test@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_USERNAME',
        })
      );
    });

    it('should return 400 if password is too short', async () => {
      const req = mockRequest({
        username: 'testuser',
        email: 'test@test.com',
        password: '12345',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_PASSWORD',
        })
      );
    });

    it('should return 400 if email format is invalid', async () => {
      const req = mockRequest({
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_EMAIL',
        })
      );
    });

    it('should return 409 if username already exists', async () => {
      const req = mockRequest({
        username: 'existinguser',
        email: 'new@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      authService.registerUser.mockRejectedValue(
        new Error('Username already exists')
      );

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USERNAME_EXISTS',
        })
      );
    });

    it('should return 409 if email already exists', async () => {
      const req = mockRequest({
        username: 'newuser',
        email: 'existing@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      authService.registerUser.mockRejectedValue(
        new Error('Email already exists')
      );

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EMAIL_EXISTS',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockRequest({
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
      });
      const res = mockResponse();

      authService.registerUser.mockRejectedValue(new Error('Unexpected error'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REGISTRATION_FAILED',
        })
      );
    });

    it('should trim username and lowercase email', async () => {
      const req = mockRequest({
        username: '  testuser  ',
        email: '  TEST@TEST.COM  ',
        password: 'password123',
      });
      const res = mockResponse();

      authService.registerUser.mockResolvedValue({ _id: 'id' });

      await authController.register(req, res);

      expect(authService.registerUser).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
        roles: ['beatmaker'],
      });
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const req = mockRequest({
        identifier: 'testuser',
        password: 'password123',
      });
      const res = mockResponse();

      authService.loginUser.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Login successful',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should return 400 if identifier is missing', async () => {
      const req = mockRequest({
        password: 'password123',
      });
      const res = mockResponse();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if password is missing', async () => {
      const req = mockRequest({
        identifier: 'testuser',
      });
      const res = mockResponse();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if fields are not strings', async () => {
      const req = mockRequest({
        identifier: 123,
        password: 'password123',
      });
      const res = mockResponse();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_DATA_TYPE',
        })
      );
    });

    it('should return 400 if fields are empty', async () => {
      const req = mockRequest({
        identifier: '   ',
        password: 'password123',
      });
      const res = mockResponse();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EMPTY_FIELDS',
        })
      );
    });

    it('should return 401 for invalid credentials', async () => {
      const req = mockRequest({
        identifier: 'testuser',
        password: 'wrongpassword',
      });
      const res = mockResponse();

      authService.loginUser.mockRejectedValue(new Error('Invalid credentials'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CREDENTIALS',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockRequest({
        identifier: 'testuser',
        password: 'password123',
      });
      const res = mockResponse();

      authService.loginUser.mockRejectedValue(new Error('Database error'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'LOGIN_FAILED',
        })
      );
    });

    it('should trim identifier', async () => {
      const req = mockRequest({
        identifier: '  testuser  ',
        password: 'password123',
      });
      const res = mockResponse();

      authService.loginUser.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      await authController.login(req, res);

      expect(authService.loginUser).toHaveBeenCalledWith(
        'testuser',
        'password123'
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const req = mockRequest({
        refreshToken: 'valid-refresh-token',
      });
      const res = mockResponse();

      authService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token refreshed successfully',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should return 400 if refresh token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_REFRESH_TOKEN',
        })
      );
    });

    it('should return 400 if refresh token is not a string', async () => {
      const req = mockRequest({
        refreshToken: 12345,
      });
      const res = mockResponse();

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_DATA_TYPE',
        })
      );
    });

    it('should return 400 if refresh token is empty', async () => {
      const req = mockRequest({
        refreshToken: '   ',
      });
      const res = mockResponse();

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EMPTY_REFRESH_TOKEN',
        })
      );
    });

    it('should return 401 for invalid refresh token', async () => {
      const req = mockRequest({
        refreshToken: 'invalid-token',
      });
      const res = mockResponse();

      authService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid or expired refresh token')
      );

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_REFRESH_TOKEN',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockRequest({
        refreshToken: 'some-token',
      });
      const res = mockResponse();

      authService.refreshAccessToken.mockRejectedValue(
        new Error('Database error')
      );

      await authController.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const req = mockRequest({
        refreshToken: 'refresh-token',
        accessToken: 'access-token',
      });
      const res = mockResponse();

      authService.logoutUser.mockResolvedValue(true);

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logout successful',
      });
    });

    it('should return 400 if refresh token is missing', async () => {
      const req = mockRequest({
        accessToken: 'access-token',
      });
      const res = mockResponse();

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_REFRESH_TOKEN',
        })
      );
    });

    it('should return 400 if refresh token is not a string', async () => {
      const req = mockRequest({
        refreshToken: 123,
      });
      const res = mockResponse();

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_DATA_TYPE',
        })
      );
    });

    it('should return 400 if access token is provided but not a string', async () => {
      const req = mockRequest({
        refreshToken: 'refresh-token',
        accessToken: 123,
      });
      const res = mockResponse();

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_DATA_TYPE',
        })
      );
    });

    it('should return 404 if refresh token not found', async () => {
      const req = mockRequest({
        refreshToken: 'nonexistent-token',
      });
      const res = mockResponse();

      authService.logoutUser.mockRejectedValue(
        new Error('Refresh token not found')
      );

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TOKEN_NOT_FOUND',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockRequest({
        refreshToken: 'some-token',
      });
      const res = mockResponse();

      authService.logoutUser.mockRejectedValue(new Error('Unexpected error'));

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('revokeAll', () => {
    it('should revoke all tokens successfully', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      authService.revokeAllUserTokens.mockResolvedValue(5);

      await authController.revokeAll(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All tokens revoked successfully',
        revokedCount: 5,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      const req = mockRequest({}, null);
      const res = mockResponse();

      await authController.revokeAll(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AUTHENTICATION_REQUIRED',
        })
      );
    });

    it('should return 401 if user id is missing', async () => {
      const req = mockRequest({}, { username: 'test' }); // No id
      const res = mockResponse();

      await authController.revokeAll(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 on service error', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      authService.revokeAllUserTokens.mockRejectedValue(
        new Error('Service error')
      );

      await authController.revokeAll(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REVOKE_FAILED',
        })
      );
    });
  });
});
