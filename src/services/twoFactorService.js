import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import User from '../models/User.js';
import logger from '../../logger.js';
import * as tokenService from './tokenService.js';
import { getRedisClient } from '../config/redis.js';

// Configuración de TOTP
authenticator.options = {
  digits: 6,
  step: 30, // 30 segundos por código
  window: 1, // Permite 1 código anterior/siguiente (±30 segundos)
};

const APP_NAME = process.env.APP_NAME || 'SocialBeats';
const TEMP_TOKEN_EXPIRY = 5 * 60; // 5 minutos en segundos

/**
 * Genera un secreto TOTP y el QR code para configurar 2FA
 * @param {string} userId - ID del usuario
 * @returns {Object} - Secreto, QR code en base64, y URL otpauth
 */
export const generateSetup = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (user.isTwoFactorEnabled) {
    throw new Error('2FA ya está activado');
  }

  // Generar secreto
  const secret = authenticator.generateSecret();

  // Generar URL OTPAuth
  const otpauthUrl = authenticator.keyuri(user.email, APP_NAME, secret);

  // Generar QR code como data URL (base64)
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Guardar secreto temporalmente (sin activar 2FA todavía)
  user.twoFactorSecret = secret;
  await user.save();

  logger.info(`2FA setup initiated for user: ${user.username}`);

  return {
    secret,
    qrCodeDataUrl,
    otpauthUrl,
  };
};

/**
 * Genera códigos de backup aleatorios
 * @param {number} count - Número de códigos a generar
 * @returns {string[]} - Array de códigos de backup
 */
const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generar código de 8 caracteres alfanuméricos
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Activa 2FA después de verificar un código válido
 * @param {string} userId - ID del usuario
 * @param {string} code - Código OTP a verificar
 * @returns {Object} - Códigos de backup generados
 */
export const enable2FA = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (user.isTwoFactorEnabled) {
    throw new Error('2FA ya está activado');
  }

  if (!user.twoFactorSecret) {
    throw new Error('2FA no iniciado. Llame a /2fa/setup primero');
  }

  // Verificar que el código es válido
  const isValid = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  if (!isValid) {
    throw new Error('Código de verificación inválido');
  }

  // Generar códigos de backup
  const backupCodes = generateBackupCodes(10);

  // Activar 2FA
  user.isTwoFactorEnabled = true;
  user.backupCodes = backupCodes;
  await user.save();

  logger.info(`2FA enabled for user: ${user.username}`);

  return {
    enabled: true,
    backupCodes,
  };
};

/**
 * Desactiva 2FA para un usuario
 * @param {string} userId - ID del usuario
 * @param {string} code - Código OTP o código de backup para verificar
 * @returns {boolean} - true si se desactivó correctamente
 */
export const disable2FA = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.isTwoFactorEnabled) {
    throw new Error('2FA no está activado');
  }

  // Verificar código OTP o backup
  const isValidOTP = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  const backupCodeIndex = user.backupCodes.indexOf(code.toUpperCase());
  const isValidBackup = backupCodeIndex !== -1;

  if (!isValidOTP && !isValidBackup) {
    throw new Error('Código de verificación inválido');
  }

  // Si usó un código de backup, eliminarlo
  if (isValidBackup) {
    user.backupCodes.splice(backupCodeIndex, 1);
  }

  // Desactivar 2FA
  user.isTwoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.backupCodes = [];
  await user.save();

  logger.info(`2FA disabled for user: ${user.username}`);

  return true;
};

/**
 * Verifica un código OTP
 * @param {string} userId - ID del usuario
 * @param {string} code - Código OTP a verificar
 * @returns {boolean} - true si el código es válido
 */
export const verifyCode = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
    throw new Error('2FA no está activado para este usuario');
  }

  // Verificar código OTP
  const isValidOTP = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  if (isValidOTP) {
    return true;
  }

  // Verificar si es un código de backup
  const backupCodeIndex = user.backupCodes.indexOf(code.toUpperCase());
  if (backupCodeIndex !== -1) {
    // Eliminar el código de backup usado (one-time use)
    user.backupCodes.splice(backupCodeIndex, 1);
    await user.save();
    logger.info(`Backup code used for user: ${user.username}`);
    return true;
  }

  return false;
};

/**
 * Obtiene los códigos de backup de un usuario
 * @param {string} userId - ID del usuario
 * @returns {string[]} - Array de códigos de backup restantes
 */
export const getBackupCodes = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.isTwoFactorEnabled) {
    throw new Error('2FA no está activado');
  }

  return user.backupCodes;
};

/**
 * Regenera los códigos de backup
 * @param {string} userId - ID del usuario
 * @param {string} code - Código OTP para verificar
 * @returns {string[]} - Nuevos códigos de backup
 */
export const regenerateBackupCodes = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.isTwoFactorEnabled) {
    throw new Error('2FA no está activado');
  }

  // Verificar código OTP
  const isValid = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  if (!isValid) {
    throw new Error('Código de verificación inválido');
  }

  // Generar nuevos códigos de backup
  const backupCodes = generateBackupCodes(10);
  user.backupCodes = backupCodes;
  await user.save();

  logger.info(`Backup codes regenerated for user: ${user.username}`);

  return backupCodes;
};

/**
 * Genera un token temporal para el flujo de 2FA durante login
 * @param {Object} user - Usuario de la base de datos
 * @returns {string} - Token temporal
 */
export const generateTempToken = async (user) => {
  const tempToken = crypto.randomBytes(32).toString('hex');

  // Almacenar en Redis con expiración
  const redis = getRedisClient();
  const key = `2fa_temp:${tempToken}`;
  await redis.setex(
    key,
    TEMP_TOKEN_EXPIRY,
    JSON.stringify({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      roles: user.roles,
    })
  );

  logger.info(`2FA temp token generated for user: ${user.username}`);

  return tempToken;
};

/**
 * Valida el token temporal y el código OTP, luego genera tokens finales
 * @param {string} tempToken - Token temporal del login
 * @param {string} code - Código OTP
 * @returns {Object} - accessToken y refreshToken
 */
export const verifyAndGenerateTokens = async (tempToken, code) => {
  const redis = getRedisClient();
  const key = `2fa_temp:${tempToken}`;

  // Obtener datos del token temporal
  const tempData = await redis.get(key);
  if (!tempData) {
    throw new Error('Token temporal inválido o expirado');
  }

  const userData = JSON.parse(tempData);

  // Verificar código OTP
  const isValid = await verifyCode(userData.userId, code);
  if (!isValid) {
    throw new Error('Código de verificación inválido');
  }

  // Eliminar token temporal
  await redis.del(key);

  // Obtener el usuario completo para generar tokens
  const user = await User.findById(userData.userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Generar tokens finales
  const accessToken = await tokenService.generateAndStoreAccessToken(user);
  const refreshToken = await tokenService.generateAndStoreRefreshToken(
    user._id
  );

  logger.info(
    `2FA verification successful, tokens generated for user: ${user.username}`
  );

  return {
    accessToken,
    refreshToken: refreshToken.token,
  };
};

/**
 * Verifica si un usuario tiene 2FA activo
 * @param {string} userId - ID del usuario
 * @returns {boolean} - true si tiene 2FA activo
 */
export const is2FAEnabled = async (userId) => {
  const user = await User.findById(userId);
  return user?.isTwoFactorEnabled || false;
};
