import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Create Redis mock factory
const createRedisMock = () => ({
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
});

let redisMock = createRedisMock();

// Mock dependencies
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));

vi.mock('../../../src/services/tokenService.js', () => ({
  generateAndStoreAccessToken: vi.fn(),
  generateAndStoreRefreshToken: vi.fn(),
}));

vi.mock('../../../src/config/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../../../logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: vi.fn().mockReturnValue('TESTSECRET123456'),
    keyuri: vi
      .fn()
      .mockReturnValue('otpauth://totp/App:test@test.com?secret=TESTSECRET'),
    verify: vi.fn(),
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQR'),
  },
}));

import * as twoFactorService from '../../../src/services/twoFactorService.js';
import User from '../../../src/models/User.js';
import { authenticator } from 'otplib';

describe('TwoFactorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock = createRedisMock();
  });

  describe('generateSetup', () => {
    it('should generate 2FA setup with QR code and secret', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@test.com',
        isTwoFactorEnabled: false,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);

      const result = await twoFactorService.generateSetup(
        mockUser._id.toString()
      );

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('otpauthUrl');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw if user not found or 2FA already enabled', async () => {
      User.findById.mockResolvedValue(null);
      await expect(twoFactorService.generateSetup('id')).rejects.toThrow(
        'User not found'
      );

      User.findById.mockResolvedValue({ isTwoFactorEnabled: true });
      await expect(twoFactorService.generateSetup('id')).rejects.toThrow(
        '2FA is already enabled'
      );
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA and return backup codes with valid OTP', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        isTwoFactorEnabled: false,
        twoFactorSecret: 'SECRET',
        backupCodes: [],
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);
      authenticator.verify.mockReturnValue(true);

      const result = await twoFactorService.enable2FA(
        mockUser._id.toString(),
        '123456'
      );

      expect(result.enabled).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
      expect(mockUser.isTwoFactorEnabled).toBe(true);
    });

    it('should throw for invalid code or missing setup', async () => {
      const mockUser = { isTwoFactorEnabled: false, twoFactorSecret: 'SECRET' };
      User.findById.mockResolvedValue(mockUser);
      authenticator.verify.mockReturnValue(false);

      await expect(twoFactorService.enable2FA('id', '000000')).rejects.toThrow(
        'Invalid verification code'
      );

      User.findById.mockResolvedValue({
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
      });
      await expect(twoFactorService.enable2FA('id', '123456')).rejects.toThrow(
        '2FA setup not initiated'
      );
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA with valid OTP or backup code', async () => {
      const mockUser = {
        isTwoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['BACKUP12'],
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);
      authenticator.verify.mockReturnValue(true);

      const result = await twoFactorService.disable2FA('id', '123456');
      expect(result).toBe(true);
      expect(mockUser.isTwoFactorEnabled).toBe(false);
    });

    it('should throw if 2FA not enabled or invalid code', async () => {
      User.findById.mockResolvedValue({ isTwoFactorEnabled: false });
      await expect(twoFactorService.disable2FA('id', '123456')).rejects.toThrow(
        '2FA is not enabled'
      );

      User.findById.mockResolvedValue({
        isTwoFactorEnabled: true,
        twoFactorSecret: 'S',
        backupCodes: [],
      });
      authenticator.verify.mockReturnValue(false);
      await expect(
        twoFactorService.disable2FA('id', 'INVALID')
      ).rejects.toThrow('Invalid verification code');
    });
  });

  describe('verifyCode', () => {
    it('should verify OTP and backup codes correctly', async () => {
      const mockUser = {
        isTwoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['BACKUP12'],
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);

      // Valid OTP
      authenticator.verify.mockReturnValue(true);
      expect(await twoFactorService.verifyCode('id', '123456')).toBe(true);

      // Valid backup code (OTP fails)
      authenticator.verify.mockReturnValue(false);
      expect(await twoFactorService.verifyCode('id', 'BACKUP12')).toBe(true);

      // Invalid code
      mockUser.backupCodes = [];
      expect(await twoFactorService.verifyCode('id', 'INVALID')).toBe(false);
    });
  });

  describe('getBackupCodes & regenerateBackupCodes', () => {
    it('should get and regenerate backup codes', async () => {
      const mockUser = {
        isTwoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['OLD1', 'OLD2'],
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);
      authenticator.verify.mockReturnValue(true);

      const codes = await twoFactorService.getBackupCodes('id');
      expect(codes).toEqual(['OLD1', 'OLD2']);

      const newCodes = await twoFactorService.regenerateBackupCodes(
        'id',
        '123456'
      );
      expect(newCodes).toHaveLength(10);
    });
  });

  describe('is2FAEnabled', () => {
    it('should return correct enabled status', async () => {
      User.findById.mockResolvedValue({ isTwoFactorEnabled: true });
      expect(await twoFactorService.is2FAEnabled('id')).toBe(true);

      User.findById.mockResolvedValue({ isTwoFactorEnabled: false });
      expect(await twoFactorService.is2FAEnabled('id')).toBe(false);

      User.findById.mockResolvedValue(null);
      expect(await twoFactorService.is2FAEnabled('id')).toBe(false);
    });
  });

  describe('generateTempToken & verifyAndGenerateTokens', () => {
    it('should generate 64-char hex temp token', async () => {
      const result = await twoFactorService.generateTempToken({
        _id: 'id',
        username: 'u',
        email: 'e',
        roles: [],
      });
      expect(result).toHaveLength(64);
    });

    it('should throw for invalid temp token', async () => {
      redisMock.get.mockResolvedValue(null);
      await expect(
        twoFactorService.verifyAndGenerateTokens('invalid', '123456')
      ).rejects.toThrow('Invalid or expired temp token');
    });
  });
});
