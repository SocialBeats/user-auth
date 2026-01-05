import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/twoFactorService.js', () => ({
  generateSetup: vi.fn(),
  enable2FA: vi.fn(),
  disable2FA: vi.fn(),
  is2FAEnabled: vi.fn(),
  getBackupCodes: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  verifyAndGenerateTokens: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import * as twoFactorController from '../../../src/controllers/twoFactorController.js';
import * as twoFactorService from '../../../src/services/twoFactorService.js';

describe('TwoFactorController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('get2FAStatus', () => {
    it('should return 2FA status', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.is2FAEnabled.mockResolvedValue(true);

      await twoFactorController.get2FAStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe('setup2FA', () => {
    it('should return QR code and secret on success', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.generateSetup.mockResolvedValue({
        secret: 'SECRET',
        qrCodeDataUrl: 'data:image/png;base64,QR',
        otpauthUrl: 'otpauth://...',
      });

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ secret: 'SECRET' })
      );
    });

    it('should handle errors correctly', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.generateSetup.mockRejectedValue(
        new Error('2FA ya está activado')
      );

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA with valid code', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.enable2FA.mockResolvedValue({
        enabled: true,
        backupCodes: ['C1', 'C2'],
      });

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodes: ['C1', 'C2'] })
      );
    });

    it('should validate code format', async () => {
      mockReq = { user: { id: 'user-123' }, body: {} };
      await twoFactorController.enable2FA(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body = { code: '12345' }; // 5 digits
      await twoFactorController.enable2FA(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA with valid code', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockResolvedValue(true);

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle errors', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockRejectedValue(
        new Error('2FA no está activado')
      );

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getBackupCodes & regenerateBackupCodes', () => {
    it('should return and regenerate backup codes', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.getBackupCodes.mockResolvedValue(['C1', 'C2', 'C3']);

      await twoFactorController.getBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        backupCodes: ['C1', 'C2', 'C3'],
        remaining: 3,
      });

      mockReq.body = { code: '123456' };
      twoFactorService.regenerateBackupCodes.mockResolvedValue([
        'NEW1',
        'NEW2',
      ]);

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodes: ['NEW1', 'NEW2'] })
      );
    });
  });

  describe('verify2FA', () => {
    it('should verify 2FA and return tokens', async () => {
      mockReq = { body: { tempToken: 'temp-123', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'access' })
      );
    });

    it('should validate required fields', async () => {
      mockReq = { body: { code: '123456' } };
      await twoFactorController.verify2FA(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq = { body: { tempToken: 'temp' } };
      await twoFactorController.verify2FA(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle invalid token/code', async () => {
      mockReq = { body: { tempToken: 'invalid', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockRejectedValue(
        new Error('Token temporal inválido o expirado')
      );

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
