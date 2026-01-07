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

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null };

      await twoFactorController.get2FAStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AUTHENTICATION_REQUIRED',
        })
      );
    });

    it('should return 500 on service error', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.is2FAEnabled.mockRejectedValue(new Error('DB error'));

      await twoFactorController.get2FAStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_STATUS_FAILED',
        })
      );
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

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null };

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if user not found', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.generateSetup.mockRejectedValue(
        new Error('Usuario no encontrado')
      );

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 400 if 2FA already enabled', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.generateSetup.mockRejectedValue(
        new Error('2FA ya está activado')
      );

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_ALREADY_ENABLED',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.generateSetup.mockRejectedValue(
        new Error('Unknown error')
      );

      await twoFactorController.setup2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_SETUP_FAILED',
        })
      );
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

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null, body: { code: '123456' } };

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if code is missing', async () => {
      mockReq = { user: { id: 'user-123' }, body: {} };
      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_CODE',
        })
      );
    });

    it('should return 400 if code has wrong length', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '12345' } }; // 5 digits
      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CODE_FORMAT',
        })
      );
    });

    it('should return 404 if user not found', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.enable2FA.mockRejectedValue(
        new Error('Usuario no encontrado')
      );

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if 2FA setup not initiated', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.enable2FA.mockRejectedValue(
        new Error('2FA no iniciado. Llame a /2fa/setup primero')
      );

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_SETUP_NOT_INITIATED',
        })
      );
    });

    it('should return 400 if code is invalid', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.enable2FA.mockRejectedValue(
        new Error('Código de verificación inválido')
      );

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CODE',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.enable2FA.mockRejectedValue(new Error('Unknown error'));

      await twoFactorController.enable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_ENABLE_FAILED',
        })
      );
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA with valid code', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockResolvedValue(true);

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null, body: { code: '123456' } };

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if code is missing', async () => {
      mockReq = { user: { id: 'user-123' }, body: {} };

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_CODE',
        })
      );
    });

    it('should return 404 if user not found', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockRejectedValue(
        new Error('Usuario no encontrado')
      );

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if 2FA is not enabled', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockRejectedValue(
        new Error('2FA no está activado')
      );

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_NOT_ENABLED',
        })
      );
    });

    it('should return 400 if code is invalid', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockRejectedValue(
        new Error('Código de verificación inválido')
      );

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CODE',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.disable2FA.mockRejectedValue(new Error('Unknown error'));

      await twoFactorController.disable2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_DISABLE_FAILED',
        })
      );
    });
  });

  describe('getBackupCodes', () => {
    it('should return backup codes', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.getBackupCodes.mockResolvedValue(['C1', 'C2', 'C3']);

      await twoFactorController.getBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        backupCodes: ['C1', 'C2', 'C3'],
        remaining: 3,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null };

      await twoFactorController.getBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if 2FA is not enabled', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.getBackupCodes.mockRejectedValue(
        new Error('2FA no está activado')
      );

      await twoFactorController.getBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_NOT_ENABLED',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { user: { id: 'user-123' } };
      twoFactorService.getBackupCodes.mockRejectedValue(
        new Error('Unknown error')
      );

      await twoFactorController.getBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'GET_BACKUP_CODES_FAILED',
        })
      );
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.regenerateBackupCodes.mockResolvedValue([
        'NEW1',
        'NEW2',
      ]);

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodes: ['NEW1', 'NEW2'] })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      mockReq = { user: null, body: { code: '123456' } };

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if code is missing', async () => {
      mockReq = { user: { id: 'user-123' }, body: {} };

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_CODE',
        })
      );
    });

    it('should return 400 if 2FA is not enabled', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.regenerateBackupCodes.mockRejectedValue(
        new Error('2FA no está activado')
      );

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_NOT_ENABLED',
        })
      );
    });

    it('should return 400 if code is invalid', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.regenerateBackupCodes.mockRejectedValue(
        new Error('Código de verificación inválido')
      );

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CODE',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { user: { id: 'user-123' }, body: { code: '123456' } };
      twoFactorService.regenerateBackupCodes.mockRejectedValue(
        new Error('Unknown error')
      );

      await twoFactorController.regenerateBackupCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REGENERATE_BACKUP_CODES_FAILED',
        })
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

    it('should return 400 if tempToken is missing', async () => {
      mockReq = { body: { code: '123456' } };
      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_TEMP_TOKEN',
        })
      );
    });

    it('should return 400 if code is missing', async () => {
      mockReq = { body: { tempToken: 'temp' } };
      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_CODE',
        })
      );
    });

    it('should return 401 if token is invalid', async () => {
      mockReq = { body: { tempToken: 'invalid', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockRejectedValue(
        new Error('Token temporal inválido o expirado')
      );

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_CODE',
        })
      );
    });

    it('should return 401 if code is invalid', async () => {
      mockReq = { body: { tempToken: 'temp', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockRejectedValue(
        new Error('Código de verificación inválido')
      );

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if user not found', async () => {
      mockReq = { body: { tempToken: 'temp', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockRejectedValue(
        new Error('Usuario no encontrado')
      );

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockReq = { body: { tempToken: 'temp', code: '123456' } };
      twoFactorService.verifyAndGenerateTokens.mockRejectedValue(
        new Error('Unknown error')
      );

      await twoFactorController.verify2FA(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '2FA_VERIFY_FAILED',
        })
      );
    });
  });
});
