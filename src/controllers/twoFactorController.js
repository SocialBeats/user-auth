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
        message: 'Autenticación requerida',
      });
    }

    const result = await twoFactorService.generateSetup(userId);

    res.status(200).json({
      message: 'Configuración de 2FA iniciada',
      secret: result.secret,
      qrCode: result.qrCodeDataUrl,
      otpauthUrl: result.otpauthUrl,
    });
  } catch (error) {
    logger.error(`2FA setup error: ${error.message}`);

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (error.message === '2FA ya está activado') {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA ya está activado para esta cuenta',
      });
    }

    res.status(500).json({
      error: '2FA_SETUP_FAILED',
      message: 'Error al configurar 2FA',
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
        message: 'El código de verificación es requerido',
      });
    }

    if (typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({
        error: 'INVALID_CODE_FORMAT',
        message: 'El código debe ser una cadena de 6 dígitos',
      });
    }

    const result = await twoFactorService.enable2FA(userId, code);

    res.status(200).json({
      message: '2FA habilitado exitosamente',
      enabled: true,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    logger.error(`2FA enable error: ${error.message}`);

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (error.message === '2FA ya está activado') {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA ya está activado',
      });
    }

    if (error.message === '2FA no iniciado. Llame a /2fa/setup primero') {
      return res.status(400).json({
        error: '2FA_SETUP_NOT_INITIATED',
        message: 'Por favor, inicia la configuración de 2FA primero',
      });
    }

    if (error.message === 'Código de verificación inválido') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Código de verificación inválido',
      });
    }

    res.status(500).json({
      error: '2FA_ENABLE_FAILED',
      message: 'Error al habilitar 2FA',
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
        message: 'Autenticación requerida',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Se necesita un código de verificación',
      });
    }

    await twoFactorService.disable2FA(userId, code);

    res.status(200).json({
      message: '2FA deshabilitado exitosamente',
      enabled: false,
    });
  } catch (error) {
    logger.error(`2FA disable error: ${error.message}`);

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (error.message === '2FA no está activado') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA no está activado para esta cuenta',
      });
    }

    if (error.message === 'Código de verificación inválido') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Código de verificación inválido',
      });
    }

    res.status(500).json({
      error: '2FA_DISABLE_FAILED',
      message: 'Error al deshabilitar 2FA',
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
        message: 'Autenticación requerida',
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
      message: 'Error al obtener el estado de 2FA',
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
        message: 'Autenticación requerida',
      });
    }

    const backupCodes = await twoFactorService.getBackupCodes(userId);

    res.status(200).json({
      backupCodes,
      remaining: backupCodes.length,
    });
  } catch (error) {
    logger.error(`Get backup codes error: ${error.message}`);

    if (error.message === '2FA no está activado') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA no está activado para esta cuenta',
      });
    }

    res.status(500).json({
      error: 'GET_BACKUP_CODES_FAILED',
      message: 'Error al obtener los códigos de respaldo',
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
        message: 'Autenticación requerida',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Se necesita un código de verificación',
      });
    }

    const backupCodes = await twoFactorService.regenerateBackupCodes(
      userId,
      code
    );

    res.status(200).json({
      message: 'Códigos de respaldo regenerados exitosamente',
      backupCodes,
    });
  } catch (error) {
    logger.error(`Regenerate backup codes error: ${error.message}`);

    if (error.message === '2FA no está activado') {
      return res.status(400).json({
        error: '2FA_NOT_ENABLED',
        message: '2FA no está activado para esta cuenta',
      });
    }

    if (error.message === 'Código de verificación inválido') {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Código de verificación inválido',
      });
    }

    res.status(500).json({
      error: 'REGENERATE_BACKUP_CODES_FAILED',
      message: 'Error al regenerar los códigos de respaldo',
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
        message: 'El token temporal es requerido',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'MISSING_CODE',
        message: 'Se necesita un código de verificación',
      });
    }

    const result = await twoFactorService.verifyAndGenerateTokens(
      tempToken,
      code
    );

    res.status(200).json({
      message: 'Login exitoso',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`2FA verify error: ${error.message}`);

    if (
      error.message === 'Token temporal inválido o expirado' ||
      error.message === 'Código de verificación inválido'
    ) {
      return res.status(401).json({
        error: 'INVALID_CODE',
        message: error.message,
      });
    }

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    res.status(500).json({
      error: '2FA_VERIFY_FAILED',
      message: 'Error al verificar el código 2FA',
    });
  }
};
