import logger from '../../logger.js';
import * as twoFactorService from '../services/twoFactorService.js';

/**
 * Inicia la configuración de 2FA generando el secreto y QR
 * Requiere autenticación
 */
export const setup2FA = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const result = await twoFactorService.generateSetup(userId);

    res.status(200).json({
      message: '2FA setup initiated',
      secret: result.secret,
      qrCode: result.qrCodeDataUrl,
      otpauthUrl: result.otpauthUrl,
    });
  } catch (error) {
    logger.error(`2FA setup error: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (error.message === '2FA is already enabled') {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA is already enabled for this account',
      });
    }

    res.status(500).json({
      error: '2FA_SETUP_FAILED',
      message: 'Failed to setup 2FA',
    });
  }
};

/**
 * Activa 2FA después de verificar un código válido
 * Requiere autenticación
 */
export const enable2FA = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Verification code is required',
      });
    }

    if (typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({
        error: 'INVALID_CODE_FORMAT',
        message: 'Code must be a 6-digit string',
      });
    }

    const result = await twoFactorService.enable2FA(userId, code);

    res.status(200).json({
      message: '2FA enabled successfully',
      enabled: true,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    logger.error(`2FA enable error: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (error.message === '2FA is already enabled') {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA is already enabled',
      });
    }

    if (error.message === '2FA setup not initiated. Call /2fa/setup first') {
      return res.status(400).json({
        error: '2FA_SETUP_NOT_INITIATED',
        message: 'Please initiate 2FA setup first',
      });
    }

    if (error.message === 'Invalid verification code') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Invalid verification code',
      });
    }

    res.status(500).json({
      error: '2FA_ENABLE_FAILED',
      message: 'Failed to enable 2FA',
    });
  }
};

/**
 * Desactiva 2FA para el usuario
 * Requiere autenticación y código OTP/backup
 */
export const disable2FA = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Verification code is required',
      });
    }

    await twoFactorService.disable2FA(userId, code);

    res.status(200).json({
      message: '2FA disabled successfully',
      enabled: false,
    });
  } catch (error) {
    logger.error(`2FA disable error: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (error.message === '2FA is not enabled') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA is not enabled for this account',
      });
    }

    if (error.message === 'Invalid verification code') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Invalid verification code',
      });
    }

    res.status(500).json({
      error: '2FA_DISABLE_FAILED',
      message: 'Failed to disable 2FA',
    });
  }
};

/**
 * Obtiene el estado de 2FA del usuario
 * Requiere autenticación
 */
export const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const enabled = await twoFactorService.is2FAEnabled(userId);

    res.status(200).json({
      enabled,
    });
  } catch (error) {
    logger.error(`2FA status error: ${error.message}`);

    res.status(500).json({
      error: '2FA_STATUS_FAILED',
      message: 'Failed to get 2FA status',
    });
  }
};

/**
 * Obtiene los códigos de backup del usuario
 * Requiere autenticación
 */
export const getBackupCodes = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const backupCodes = await twoFactorService.getBackupCodes(userId);

    res.status(200).json({
      backupCodes,
      remaining: backupCodes.length,
    });
  } catch (error) {
    logger.error(`Get backup codes error: ${error.message}`);

    if (error.message === '2FA is not enabled') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA is not enabled for this account',
      });
    }

    res.status(500).json({
      error: 'GET_BACKUP_CODES_FAILED',
      message: 'Failed to get backup codes',
    });
  }
};

/**
 * Regenera los códigos de backup
 * Requiere autenticación y código OTP
 */
export const regenerateBackupCodes = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Verification code is required',
      });
    }

    const backupCodes = await twoFactorService.regenerateBackupCodes(
      userId,
      code
    );

    res.status(200).json({
      message: 'Backup codes regenerated successfully',
      backupCodes,
    });
  } catch (error) {
    logger.error(`Regenerate backup codes error: ${error.message}`);

    if (error.message === '2FA is not enabled') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA is not enabled for this account',
      });
    }

    if (error.message === 'Invalid verification code') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Invalid verification code',
      });
    }

    res.status(500).json({
      error: 'REGENERATE_BACKUP_CODES_FAILED',
      message: 'Failed to regenerate backup codes',
    });
  }
};

/**
 * Verifica el código 2FA durante el login
 * Canjea tempToken + código por tokens finales
 */
export const verify2FA = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken) {
      return res.status(400).json({
        error: 'MISSING_TEMP_TOKEN',
        message: 'Temporary token is required',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Verification code is required',
      });
    }

    const result = await twoFactorService.verifyAndGenerateTokens(
      tempToken,
      code
    );

    res.status(200).json({
      message: 'Login successful',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`2FA verify error: ${error.message}`);

    if (
      error.message === 'Invalid or expired temp token' ||
      error.message === 'Invalid verification code'
    ) {
      return res.status(401).json({
        error: 'INVALID_CODE',
        message: error.message,
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    res.status(500).json({
      error: '2FA_VERIFY_FAILED',
      message: 'Failed to verify 2FA code',
    });
  }
};
