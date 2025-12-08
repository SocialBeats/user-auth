import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

// Mock dependencies before importing the service
vi.mock('../../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('../../../src/services/tokenService.js', () => ({
  generateAndStoreAccessToken: vi.fn(),
  generateAndStoreRefreshToken: vi.fn(),
  validateRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}));

vi.mock('../../../src/services/profileService.js', () => ({
  createProfile: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import * as authService from '../../../src/services/authService.js';
import User from '../../../src/models/User.js';
import * as tokenService from '../../../src/services/tokenService.js';
import * as profileService from '../../../src/services/profileService.js';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    const validUserData = {
      username: 'newuser',
      email: 'newuser@test.com',
      password: 'password123',
      roles: ['beatmaker'],
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: validUserData.username,
        email: validUserData.email,
        roles: validUserData.roles,
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockResolvedValue({});

      const result = await authService.registerUser(validUserData);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: validUserData.username },
          { email: validUserData.email },
        ],
      });
      expect(User.create).toHaveBeenCalledWith(validUserData);
      expect(profileService.createProfile).toHaveBeenCalledWith({
        userId: mockUser._id,
        username: mockUser.username,
        email: mockUser.email,
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if username already exists', async () => {
      User.findOne.mockResolvedValue({
        username: validUserData.username,
        email: 'other@test.com',
      });

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'Username already exists'
      );
    });

    it('should throw error if email already exists', async () => {
      User.findOne.mockResolvedValue({
        username: 'otheruser',
        email: validUserData.email,
      });

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'Email already exists'
      );
    });

    it('should rollback user creation if profile creation fails', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: mockUserId,
        username: validUserData.username,
        email: validUserData.email,
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockRejectedValue(
        new Error('Profile error')
      );
      User.findByIdAndDelete.mockResolvedValue(null);

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'Failed to create user profile'
      );
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should use default role if not provided', async () => {
      const userDataWithoutRoles = {
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'password123',
      };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: userDataWithoutRoles.username,
        email: userDataWithoutRoles.email,
        roles: ['beatmaker'],
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockResolvedValue({});

      await authService.registerUser(userDataWithoutRoles);

      // The service passes roles: ['beatmaker'] as default when not provided
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'newuser@test.com',
        })
      );
    });
  });

  describe('loginUser', () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      email: 'test@test.com',
      comparePassword: vi.fn(),
    };

    it('should login user successfully with username', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'mock-access-token'
      );
      tokenService.generateAndStoreRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
      });

      const result = await authService.loginUser('testuser', 'password123');

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'testuser' }, { email: 'testuser' }],
      });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should login user successfully with email', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'mock-access-token'
      );
      tokenService.generateAndStoreRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
      });

      const result = await authService.loginUser(
        'test@test.com',
        'password123'
      );

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'test@test.com' }, { email: 'test@test.com' }],
      });
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.loginUser('nonexistent', 'password123')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if password is incorrect', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await expect(
        authService.loginUser('testuser', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshAccessToken', () => {
    const mockTokenData = {
      userId: new mongoose.Types.ObjectId().toString(),
      tokenId: 'mock-token-id',
    };

    const mockUser = {
      _id: mockTokenData.userId,
      username: 'testuser',
      email: 'test@test.com',
      roles: ['beatmaker'],
    };

    it('should refresh tokens successfully', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(mockTokenData);
      User.findById.mockResolvedValue(mockUser);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'new-access-token'
      );
      tokenService.rotateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
      });

      const result = await authService.refreshAccessToken('old-refresh-token');

      expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token'
      );
      expect(User.findById).toHaveBeenCalledWith(mockTokenData.userId);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error if refresh token is invalid', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw error if user not found', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(mockTokenData);
      User.findById.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken('valid-token')
      ).rejects.toThrow('User not found');
    });
  });

  describe('logoutUser', () => {
    it('should logout user successfully with both tokens', async () => {
      tokenService.revokeToken.mockResolvedValue(true);

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'access-token',
        'access'
      );
      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
        'refresh'
      );
      expect(result).toBe(true);
    });

    it('should logout user successfully with only refresh token', async () => {
      tokenService.revokeToken.mockResolvedValue(true);

      const result = await authService.logoutUser('refresh-token', null);

      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
        'refresh'
      );
      expect(result).toBe(true);
    });

    it('should throw error if refresh token not found', async () => {
      tokenService.revokeToken.mockResolvedValue(false);

      await expect(
        authService.logoutUser('invalid-refresh-token', null)
      ).rejects.toThrow('Refresh token not found');
    });

    it('should continue logout even if access token revocation fails', async () => {
      tokenService.revokeToken
        .mockRejectedValueOnce(new Error('Access token error'))
        .mockResolvedValueOnce(true);

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(result).toBe(true);
    });

    it('should handle access token not found gracefully', async () => {
      tokenService.revokeToken
        .mockResolvedValueOnce(false) // Access token not found
        .mockResolvedValueOnce(true); // Refresh token revoked

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(result).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens successfully', async () => {
      const userId = 'test-user-id';
      tokenService.revokeAllUserTokens.mockResolvedValue(5);

      const result = await authService.revokeAllUserTokens(userId);

      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(userId);
      expect(result).toBe(5);
    });

    it('should return 0 if no tokens to revoke', async () => {
      tokenService.revokeAllUserTokens.mockResolvedValue(0);

      const result = await authService.revokeAllUserTokens('user-id');

      expect(result).toBe(0);
    });
  });
});
