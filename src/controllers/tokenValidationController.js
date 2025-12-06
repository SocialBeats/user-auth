import * as tokenService from '../services/tokenService.js';
import logger from '../../logger.js';

/**
 * Valida un access token contra Redis (SIN verificar firma JWT)
 * Este endpoint es llamado por la API Gateway después de que YA verificó la firma
 * Solo verifica que el token no haya sido revocado en Redis
 * @route POST /api/v1/auth/validate-token
 */
export const validateToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      logger.warn('Token validation request without token');
      return res.status(400).json({
        valid: false,
        error: 'MISSING_TOKEN',
        message: 'Token is required',
      });
    }

    logger.debug(
      `Validating token against Redis: ${token.substring(0, 20)}...`
    );

    // Validar solo contra Redis (el gateway ya verificó la firma)
    const tokenData = await tokenService.validateAccessTokenRedisOnly(token);

    if (!tokenData) {
      logger.warn('Token not found in Redis or invalid');
      return res.status(200).json({
        valid: false,
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or has been revoked',
      });
    }

    logger.info(
      `Token validated successfully for user: ${tokenData.username} (${tokenData.id})`
    );

    // Token válido - devolver datos del usuario
    res.status(200).json({
      valid: true,
      user: {
        id: tokenData.id,
        username: tokenData.username,
        email: tokenData.email,
        roles: tokenData.roles,
      },
    });
  } catch (error) {
    logger.error(`Token validation error: ${error.message}`);
    res.status(500).json({
      valid: false,
      error: 'VALIDATION_FAILED',
      message: 'Token validation failed',
    });
  }
};
