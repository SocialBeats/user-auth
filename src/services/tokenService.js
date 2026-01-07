import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';
import logger from '../../logger.js';

// Prefijos para las keys de Redis
const ACCESS_TOKEN_PREFIX = 'access_token:';
const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const USER_TOKENS_PREFIX = 'user_tokens:';

// Configuración de expiración de tokens
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRY) || 7;
const REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
const GRACE_PERIOD_SECONDS = 15; // Periodo de gracia para concurrencia

/**
 * Convierte tiempo expresado como string (ej: '15m', '1h') a segundos
 * @param {string} timeString - Tiempo como string
 * @returns {number} - Tiempo en segundos
 */
const timeToSeconds = (timeString) => {
  const unit = timeString.slice(-1);
  const value = parseInt(timeString.slice(0, -1));

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 900; // Default 15 minutos
  }
};

const ACCESS_TOKEN_EXPIRY_SECONDS = timeToSeconds(ACCESS_TOKEN_EXPIRY);

/**
 * Genera y almacena un Access Token en Redis
 * @param {Object} user - Datos del usuario
 * @returns {Promise<string>} - Access token generado
 */
export const generateAndStoreAccessToken = async (user) => {
  const redis = getRedisClient();

  const payload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    roles: user.roles,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const tokenId = crypto.randomBytes(16).toString('hex');

  const tokenData = {
    userId: user._id.toString(),
    username: user.username,
    type: 'access',
    createdAt: new Date().toISOString(),
  };

  // Key: access_token:{tokenId}
  const tokenKey = `${ACCESS_TOKEN_PREFIX}${tokenId}`;
  await redis.setex(
    tokenKey,
    ACCESS_TOKEN_EXPIRY_SECONDS,
    JSON.stringify(tokenData)
  );

  const userTokensKey = `${USER_TOKENS_PREFIX}${user._id}:access`;
  await redis.sadd(userTokensKey, tokenId);
  await redis.expire(userTokensKey, ACCESS_TOKEN_EXPIRY_SECONDS);

  const tokenHashKey = `token_map:${token}`;
  await redis.setex(tokenHashKey, ACCESS_TOKEN_EXPIRY_SECONDS, tokenId);

  logger.info(`Access token generated and stored for user: ${user.username}`);
  return token;
};

/**
 * Genera y almacena un Refresh Token en Redis
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} - Objeto con token y expiración
 */
export const generateAndStoreRefreshToken = async (userId) => {
  const redis = getRedisClient();

  const token = crypto.randomBytes(64).toString('hex');
  const tokenId = crypto.randomBytes(16).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  const tokenData = {
    userId: userId.toString(),
    type: 'refresh',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Key: refresh_token:{tokenId}
  const tokenKey = `${REFRESH_TOKEN_PREFIX}${tokenId}`;
  await redis.setex(
    tokenKey,
    REFRESH_TOKEN_EXPIRY_SECONDS,
    JSON.stringify(tokenData)
  );

  const userTokensKey = `${USER_TOKENS_PREFIX}${userId}:refresh`;
  await redis.sadd(userTokensKey, tokenId);
  await redis.expire(userTokensKey, REFRESH_TOKEN_EXPIRY_SECONDS);

  const tokenHashKey = `token_map:${token}`;
  await redis.setex(tokenHashKey, REFRESH_TOKEN_EXPIRY_SECONDS, tokenId);

  logger.info(`Refresh token generated and stored for user: ${userId}`);
  return { token, expiresAt };
};

/**
 * Valida un Access Token verificando SOLO su existencia en Redis (sin verificar firma JWT)
 * Usar cuando el gateway ya verificó la firma
 * @param {string} token - Access token a validar
 * @returns {Promise<Object|null>} - Datos del token si existe en Redis, null si no
 */
export const validateAccessTokenRedisOnly = async (token) => {
  const redis = getRedisClient();

  try {
    // Verificar que el token existe en Redis (no ha sido revocado)
    const tokenHashKey = `token_map:${token}`;
    const tokenId = await redis.get(tokenHashKey);

    if (!tokenId) {
      logger.warn('Token not found in Redis - may have been revoked');
      return null;
    }

    const tokenKey = `${ACCESS_TOKEN_PREFIX}${tokenId}`;
    const tokenDataStr = await redis.get(tokenKey);

    if (!tokenDataStr) {
      logger.warn('Token data not found in Redis');
      return null;
    }

    const tokenData = JSON.parse(tokenDataStr);

    const decoded = jwt.decode(token);

    return {
      ...decoded,
      tokenId,
      ...tokenData,
    };
  } catch (error) {
    logger.error(`Token validation error: ${error.message}`);
    return null;
  }
};

/**
 * Valida un Access Token verificando firma JWT Y existencia en Redis
 * Usar para acceso directo al microservicio (sin gateway)
 * @param {string} token - Access token a validar
 * @returns {Promise<Object|null>} - Datos del token si es válido, null si no
 */
export const validateAccessToken = async (token) => {
  const redis = getRedisClient();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenHashKey = `token_map:${token}`;
    const tokenId = await redis.get(tokenHashKey);

    if (!tokenId) {
      logger.warn('Token not found in Redis - may have been revoked');
      return null;
    }

    const tokenKey = `${ACCESS_TOKEN_PREFIX}${tokenId}`;
    const tokenDataStr = await redis.get(tokenKey);

    if (!tokenDataStr) {
      logger.warn('Token data not found in Redis');
      return null;
    }

    const tokenData = JSON.parse(tokenDataStr);

    return {
      ...decoded,
      tokenId,
      ...tokenData,
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token signature');
    } else {
      logger.error(`Token validation error: ${error.message}`);
    }
    return null;
  }
};

/**
 * Valida un Refresh Token verificando su existencia en Redis
 * @param {string} token - Refresh token a validar
 * @returns {Promise<Object|null>} - Datos del token si es válido, null si no
 */
export const validateRefreshToken = async (token) => {
  const redis = getRedisClient();

  try {
    const tokenHashKey = `token_map:${token}`;
    const tokenId = await redis.get(tokenHashKey);

    if (!tokenId) {
      logger.warn('Refresh token not found in Redis');
      return null;
    }

    const tokenKey = `${REFRESH_TOKEN_PREFIX}${tokenId}`;
    const tokenDataStr = await redis.get(tokenKey);

    if (!tokenDataStr) {
      logger.warn('Refresh token data not found in Redis');
      return null;
    }

    const tokenData = JSON.parse(tokenDataStr);

    const expiresAt = new Date(tokenData.expiresAt);
    if (expiresAt < new Date()) {
      logger.warn('Refresh token expired');
      return null;
    }

    const ttl = await redis.ttl(tokenKey);
    const isInGracePeriod = ttl > 0 && ttl <= GRACE_PERIOD_SECONDS;

    return {
      ...tokenData,
      tokenId,
      token,
      isInGracePeriod,
    };
  } catch (error) {
    logger.error(`Refresh token validation error: ${error.message}`);
    return null;
  }
};

/**
 * Rota un refresh token: reduce el TTL del viejo a periodo de gracia y genera uno nuevo
 * @param {string} oldToken - Refresh token actual
 * @param {Object} tokenData - Datos del token validado
 * @returns {Promise<Object>} - Nuevo refresh token generado
 */
export const rotateRefreshToken = async (oldToken, tokenData) => {
  const redis = getRedisClient();

  try {
    const { tokenId, userId, isInGracePeriod } = tokenData;

    if (isInGracePeriod) {
      logger.warn(
        `Refresh token ${tokenId} is in grace period - allowing reuse`
      );
    } else {
      // Reducir TTL del token viejo a periodo de gracia (15 segundos)
      const tokenKey = `${REFRESH_TOKEN_PREFIX}${tokenId}`;
      const tokenHashKey = `token_map:${oldToken}`;

      await redis.expire(tokenKey, GRACE_PERIOD_SECONDS);
      await redis.expire(tokenHashKey, GRACE_PERIOD_SECONDS);

      logger.info(
        `Refresh token ${tokenId} moved to grace period (${GRACE_PERIOD_SECONDS}s)`
      );
    }

    const newRefreshToken = await generateAndStoreRefreshToken(userId);

    logger.info(`Refresh token rotated for user: ${userId}`);
    return newRefreshToken;
  } catch (error) {
    logger.error(`Refresh token rotation error: ${error.message}`);
    throw error;
  }
};

/**
 * Revoca un token específico eliminándolo de Redis
 * @param {string} token - Token a revocar (access o refresh)
 * @param {string} type - Tipo de token ('access' o 'refresh')
 * @returns {Promise<boolean>} - true si se revocó correctamente
 */
export const revokeToken = async (token, type = 'refresh') => {
  const redis = getRedisClient();

  try {
    const tokenHashKey = `token_map:${token}`;
    const tokenId = await redis.get(tokenHashKey);

    if (!tokenId) {
      logger.warn('Token not found for revocation');
      return false;
    }

    const prefix =
      type === 'access' ? ACCESS_TOKEN_PREFIX : REFRESH_TOKEN_PREFIX;
    const tokenKey = `${prefix}${tokenId}`;

    await redis.del(tokenKey);
    await redis.del(tokenHashKey);

    logger.info(`Token revoked: ${tokenId}`);
    return true;
  } catch (error) {
    logger.error(`Token revocation error: ${error.message}`);
    return false;
  }
};

/**
 * Revoca todos los tokens de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de tokens revocados
 */
export const revokeAllUserTokens = async (userId) => {
  const redis = getRedisClient();

  try {
    let totalRevoked = 0;

    const accessTokensKey = `${USER_TOKENS_PREFIX}${userId}:access`;
    const accessTokenIds = await redis.smembers(accessTokensKey);

    for (const tokenId of accessTokenIds) {
      const tokenKey = `${ACCESS_TOKEN_PREFIX}${tokenId}`;
      await redis.del(tokenKey);
      totalRevoked++;
    }
    await redis.del(accessTokensKey);

    const refreshTokensKey = `${USER_TOKENS_PREFIX}${userId}:refresh`;
    const refreshTokenIds = await redis.smembers(refreshTokensKey);

    for (const tokenId of refreshTokenIds) {
      const tokenKey = `${REFRESH_TOKEN_PREFIX}${tokenId}`;
      await redis.del(tokenKey);
      totalRevoked++;
    }
    await redis.del(refreshTokensKey);

    logger.info(
      `All tokens revoked for user ${userId}. Total: ${totalRevoked}`
    );
    return totalRevoked;
  } catch (error) {
    logger.error(`Error revoking all user tokens: ${error.message}`);
    throw error;
  }
};

/**
 * Obtiene información sobre los tokens activos de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} - Información de tokens activos
 */
export const getUserTokensInfo = async (userId) => {
  const redis = getRedisClient();

  try {
    const accessTokensKey = `${USER_TOKENS_PREFIX}${userId}:access`;
    const refreshTokensKey = `${USER_TOKENS_PREFIX}${userId}:refresh`;

    const accessTokenIds = await redis.smembers(accessTokensKey);
    const refreshTokenIds = await redis.smembers(refreshTokensKey);

    return {
      userId,
      activeAccessTokens: accessTokenIds.length,
      activeRefreshTokens: refreshTokenIds.length,
      totalActive: accessTokenIds.length + refreshTokenIds.length,
    };
  } catch (error) {
    logger.error(`Error getting user tokens info: ${error.message}`);
    return {
      userId,
      activeAccessTokens: 0,
      activeRefreshTokens: 0,
      totalActive: 0,
    };
  }
};
