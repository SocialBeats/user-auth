import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Mock Redis client
const mockRedisClient = {
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  ttl: vi.fn().mockResolvedValue(100),
  keys: vi.fn().mockResolvedValue([]),
};

vi.mock('../../../src/config/redis.js', () => ({
  getRedisClient: () => mockRedisClient,
  createRedisClient: () => mockRedisClient,
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Need to set JWT_SECRET before importing
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7';

// Import after mocks
import * as tokenService from '../../../src/services/tokenService.js';

describe('TokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAndStoreAccessToken', () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      email: 'test@test.com',
      roles: ['beatmaker'],
    };

    it('should generate and store access token successfully', async () => {
      const token = await tokenService.generateAndStoreAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token is a valid JWT
      const decoded = jwt.decode(token);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.roles).toEqual(mockUser.roles);

      // Verify Redis calls
      expect(mockRedisClient.setex).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalled();
    });

    it('should include user ID in token payload', async () => {
      const token = await tokenService.generateAndStoreAccessToken(mockUser);
      const decoded = jwt.decode(token);

      expect(decoded.id).toBe(mockUser._id.toString());
    });
  });

  describe('generateAndStoreRefreshToken', () => {
    const userId = new mongoose.Types.ObjectId();

    it('should generate and store refresh token successfully', async () => {
      const result = await tokenService.generateAndStoreRefreshToken(userId);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);

      // Verify Redis calls
      expect(mockRedisClient.setex).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalled();
    });

    it('should set proper expiration date', async () => {
      const result = await tokenService.generateAndStoreRefreshToken(userId);

      const expiresAt = new Date(result.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt - now) / (1000 * 60 * 60 * 24);

      // Should expire in approximately 7 days
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });
  });

  describe('validateAccessTokenRedisOnly', () => {
    it('should return token data if valid in Redis', async () => {
      const mockToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        process.env.JWT_SECRET
      );
      const tokenId = 'mock-token-id';
      const tokenData = {
        userId: 'user123',
        username: 'testuser',
        type: 'access',
      };

      mockRedisClient.get
        .mockResolvedValueOnce(tokenId) // token map lookup
        .mockResolvedValueOnce(JSON.stringify(tokenData)); // token data lookup

      const result = await tokenService.validateAccessTokenRedisOnly(mockToken);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user123');
      expect(result.username).toBe('testuser');
    });

    it('should return null if token not found in Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result =
        await tokenService.validateAccessTokenRedisOnly('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null if token data not found', async () => {
      mockRedisClient.get
        .mockResolvedValueOnce('token-id')
        .mockResolvedValueOnce(null);

      const result =
        await tokenService.validateAccessTokenRedisOnly('some-token');

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error')
      );

      const result =
        await tokenService.validateAccessTokenRedisOnly('some-token');

      expect(result).toBeNull();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate token with JWT verification and Redis check', async () => {
      const mockToken = jwt.sign(
        {
          id: 'user123',
          username: 'testuser',
          email: 'test@test.com',
          roles: ['beatmaker'],
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      const tokenId = 'mock-token-id';
      const tokenData = {
        userId: 'user123',
        username: 'testuser',
        type: 'access',
      };

      mockRedisClient.get
        .mockResolvedValueOnce(tokenId)
        .mockResolvedValueOnce(JSON.stringify(tokenData));

      const result = await tokenService.validateAccessToken(mockToken);

      expect(result).toBeDefined();
      expect(result.id).toBe('user123');
    });

    it('should return null for expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      const result = await tokenService.validateAccessToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should return null for invalid signature', async () => {
      const invalidToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        'wrong-secret'
      );

      const result = await tokenService.validateAccessToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should return null if token not in Redis', async () => {
      const validToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        process.env.JWT_SECRET
      );

      mockRedisClient.get.mockResolvedValue(null);

      const result = await tokenService.validateAccessToken(validToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed token (general error)', async () => {
      // Completely malformed token
      const result = await tokenService.validateAccessToken(
        'not-a-valid-jwt-at-all'
      );

      expect(result).toBeNull();
    });

    it('should return null if token data not found in Redis', async () => {
      const validToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        process.env.JWT_SECRET
      );

      // Token map exists but token data doesn't
      mockRedisClient.get
        .mockResolvedValueOnce('token-id')
        .mockResolvedValueOnce(null);

      const result = await tokenService.validateAccessToken(validToken);

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      const validToken = jwt.sign(
        { id: 'user123', username: 'testuser' },
        process.env.JWT_SECRET
      );

      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error')
      );

      const result = await tokenService.validateAccessToken(validToken);

      expect(result).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate refresh token successfully', async () => {
      const tokenId = 'mock-token-id';
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const tokenData = {
        userId: 'user123',
        type: 'refresh',
        expiresAt: expiresAt.toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce(tokenId)
        .mockResolvedValueOnce(JSON.stringify(tokenData));
      mockRedisClient.ttl.mockResolvedValue(86400); // 1 day

      const result = await tokenService.validateRefreshToken(
        'valid-refresh-token'
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe('user123');
      expect(result.isInGracePeriod).toBe(false);
    });

    it('should return null for missing refresh token', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await tokenService.validateRefreshToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for expired refresh token', async () => {
      const tokenId = 'mock-token-id';
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Expired yesterday

      const tokenData = {
        userId: 'user123',
        type: 'refresh',
        expiresAt: expiredDate.toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce(tokenId)
        .mockResolvedValueOnce(JSON.stringify(tokenData));

      const result = await tokenService.validateRefreshToken('expired-token');

      expect(result).toBeNull();
    });

    it('should detect grace period', async () => {
      const tokenId = 'mock-token-id';
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const tokenData = {
        userId: 'user123',
        type: 'refresh',
        expiresAt: expiresAt.toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce(tokenId)
        .mockResolvedValueOnce(JSON.stringify(tokenData));
      mockRedisClient.ttl.mockResolvedValue(10); // 10 seconds (within grace period)

      const result = await tokenService.validateRefreshToken('token');

      expect(result.isInGracePeriod).toBe(true);
    });

    it('should return null on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error')
      );

      const result = await tokenService.validateRefreshToken('some-token');

      expect(result).toBeNull();
    });

    it('should return null if token data is missing', async () => {
      mockRedisClient.get
        .mockResolvedValueOnce('token-id')
        .mockResolvedValueOnce(null);

      const result =
        await tokenService.validateRefreshToken('token-without-data');

      expect(result).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should rotate refresh token and expire old one', async () => {
      const tokenData = {
        userId: 'user123',
        tokenId: 'old-token-id',
        isInGracePeriod: false,
      };

      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const result = await tokenService.rotateRefreshToken(
        'old-token',
        tokenData
      );

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it('should handle grace period tokens', async () => {
      const tokenData = {
        userId: 'user123',
        tokenId: 'old-token-id',
        isInGracePeriod: true,
      };

      const result = await tokenService.rotateRefreshToken(
        'old-token',
        tokenData
      );

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      // Should not extend expire for grace period tokens (already set)
    });

    it('should throw error on Redis failure', async () => {
      const tokenData = {
        userId: 'user123',
        tokenId: 'old-token-id',
        isInGracePeriod: false,
      };

      mockRedisClient.expire.mockRejectedValue(
        new Error('Redis expire failed')
      );

      await expect(
        tokenService.rotateRefreshToken('old-token', tokenData)
      ).rejects.toThrow('Redis expire failed');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      mockRedisClient.get.mockResolvedValue('token-id');
      mockRedisClient.del.mockResolvedValue(1);

      const result = await tokenService.revokeToken(
        'token-to-revoke',
        'access'
      );

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
    });

    it('should return false if token not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await tokenService.revokeToken(
        'nonexistent-token',
        'access'
      );

      expect(result).toBe(false);
    });

    it('should handle refresh token type', async () => {
      mockRedisClient.get.mockResolvedValue('token-id');
      mockRedisClient.del.mockResolvedValue(1);

      const result = await tokenService.revokeToken('refresh-token', 'refresh');

      expect(result).toBe(true);
    });

    it('should return false on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error')
      );

      const result = await tokenService.revokeToken('some-token', 'access');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const userId = 'user123';
      const accessTokenIds = ['access1', 'access2'];
      const refreshTokenIds = ['refresh1'];

      mockRedisClient.smembers
        .mockResolvedValueOnce(accessTokenIds) // access tokens
        .mockResolvedValueOnce(refreshTokenIds); // refresh tokens
      mockRedisClient.del.mockResolvedValue(1);

      const result = await tokenService.revokeAllUserTokens(userId);

      expect(result).toBe(3); // 2 access + 1 refresh
    });

    it('should return 0 when user has no tokens', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await tokenService.revokeAllUserTokens('user-no-tokens');

      expect(result).toBe(0);
    });

    it('should throw error on Redis failure', async () => {
      mockRedisClient.smembers.mockRejectedValue(
        new Error('Redis smembers failed')
      );

      await expect(tokenService.revokeAllUserTokens('user123')).rejects.toThrow(
        'Redis smembers failed'
      );
    });
  });

  describe('getUserTokensInfo', () => {
    it('should return token info for user', async () => {
      mockRedisClient.smembers
        .mockResolvedValueOnce(['t1', 't2', 't3']) // access tokens
        .mockResolvedValueOnce(['r1', 'r2']); // refresh tokens

      const result = await tokenService.getUserTokensInfo('user123');

      expect(result).toEqual({
        userId: 'user123',
        activeAccessTokens: 3,
        activeRefreshTokens: 2,
        totalActive: 5,
      });
    });

    it('should return zeros on error', async () => {
      mockRedisClient.smembers.mockRejectedValue(new Error('Redis error'));

      const result = await tokenService.getUserTokensInfo('user123');

      expect(result).toEqual({
        userId: 'user123',
        activeAccessTokens: 0,
        activeRefreshTokens: 0,
        totalActive: 0,
      });
    });
  });
});
