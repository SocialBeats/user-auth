import User from '../models/User.js';
import logger from '../../logger.js';
import * as tokenService from './tokenService.js';

/**
 * Registra un nuevo usuario
 * @param {Object} userData - Datos del usuario (username, email, password, roles)
 * @returns {Object} - Usuario creado (sin password)
 */
export const registerUser = async (userData) => {
  const { username, email, password, roles } = userData;

  // Validar si el usuario o email ya existen
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    if (existingUser.username === username) {
      throw new Error('Username already exists');
    }
    if (existingUser.email === email) {
      throw new Error('Email already exists');
    }
  }

  // Crear nuevo usuario (el password se hasheará automáticamente por el middleware)
  const user = await User.create({
    username,
    email,
    password,
    roles: roles || ['beatmaker'],
  });

  logger.info(`New user registered: ${username}`);
  return user;
};

/**
 * Inicia sesión y genera tokens
 * @param {string} identifier - Username o email
 * @param {string} password - Contraseña del usuario
 * @returns {Object} - Objeto con accessToken, refreshToken y datos del usuario
 */
export const loginUser = async (identifier, password) => {
  // Buscar por username o email
  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verificar contraseña
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Generar tokens usando Redis
  const accessToken = await tokenService.generateAndStoreAccessToken(user);
  const refreshToken = await tokenService.generateAndStoreRefreshToken(
    user._id
  );

  logger.info(`User logged in: ${user.username}`);

  return {
    accessToken,
    refreshToken: refreshToken.token,
  };
};

/**
 * Refresca el access token usando un refresh token válido
 * Implementa rotación de refresh tokens con periodo de gracia
 * @param {string} refreshToken - Refresh token
 * @returns {Object} - Nuevo accessToken y refreshToken
 */
export const refreshAccessToken = async (refreshToken) => {
  // Validar el refresh token en Redis
  const tokenData = await tokenService.validateRefreshToken(refreshToken);

  if (!tokenData) {
    throw new Error('Invalid or expired refresh token');
  }

  // Obtener usuario de la base de datos
  const user = await User.findById(tokenData.userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Generar nuevo access token
  const accessToken = await tokenService.generateAndStoreAccessToken(user);

  // Rotar el refresh token (con periodo de gracia)
  const newRefreshToken = await tokenService.rotateRefreshToken(
    refreshToken,
    tokenData
  );

  logger.info(
    `Tokens refreshed and rotated for user: ${user.username}` +
      (tokenData.isInGracePeriod ? ' (grace period)' : '')
  );

  return {
    accessToken,
    refreshToken: newRefreshToken.token,
  };
};

/**
 * Cierra sesión revocando el refresh token y access token
 * @param {string} refreshToken - Refresh token a revocar
 * @param {string} accessToken - Access token a revocar
 * @returns {boolean} - true si se revocó correctamente
 */
export const logoutUser = async (refreshToken, accessToken) => {
  const refreshSuccess = await tokenService.revokeToken(
    refreshToken,
    'refresh'
  );

  if (!refreshSuccess) {
    throw new Error('Refresh token not found');
  }

  // Revocar también el access token si se proporcionó
  if (accessToken) {
    await tokenService.revokeToken(accessToken, 'access');
    logger.info(`User logged out, both tokens revoked`);
  } else {
    logger.info(`User logged out, refresh token revoked`);
  }

  return true;
};

/**
 * Revoca todos los tokens de un usuario (access y refresh)
 * @param {string} userId - ID del usuario
 * @returns {number} - Número de tokens revocados
 */
export const revokeAllUserTokens = async (userId) => {
  const revokedCount = await tokenService.revokeAllUserTokens(userId);
  logger.info(`All tokens revoked for user: ${userId}`);
  return revokedCount;
};
