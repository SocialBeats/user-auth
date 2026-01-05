import crypto from 'crypto';
import User from '../models/User.js';
import logger from '../../logger.js';
import * as tokenService from './tokenService.js';
import { createProfile } from './profileService.js';
import { publishUserEvent } from './kafkaProducer.js';
import * as emailService from './emailService.js';

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
      throw new Error('El nombre de usuario ya existe');
    }
    if (existingUser.email === email) {
      throw new Error('El email ya existe');
    }
  }

  // Generar token de verificación de email
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  const user = await User.create({
    username,
    email,
    password,
    roles: roles || ['beatmaker'],
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  // Crear perfil asociado al usuario
  try {
    await createProfile({
      userId: user._id,
      username: user.username,
      email: user.email,
    });
  } catch (profileError) {
    // Si falla la creación del perfil, eliminar el usuario para mantener consistencia
    logger.error(
      `Failed to create profile for user ${username}, rolling back user creation`
    );
    await User.findByIdAndDelete(user._id);
    throw new Error('Error al crear perfil');
  }

  // Crear contrato FREE en Payments Service
  try {
    const paymentsUrl =
      process.env.PAYMENTS_SERVICE_URL ||
      'http://localhost:3006/api/v1/payments';
    const apiKey = process.env.INTERNAL_API_KEY;

    if (apiKey) {
      const response = await fetch(`${paymentsUrl}/internal/free-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': apiKey,
        },
        body: JSON.stringify({
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          plan: 'FREE',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Failed to create free contract for ${username}: ${response.status} ${errorText}`
        );
      } else {
        logger.info(`Free contract created successfully for user ${username}`);
      }
    } else {
      logger.warn('INTERNAL_API_KEY not set, skipping free contract creation');
    }
  } catch (contractError) {
    logger.error(
      `Error requesting free contract creation: ${contractError.message}`
    );
  }

  await publishUserEvent('USER_CREATED', {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    roles: user.roles,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  try {
    await emailService.sendVerificationEmail({
      email: user.email,
      username: user.username,
      verificationToken,
    });
  } catch (emailError) {
    // No bloqueamos el registro si falla el envío de email
    logger.error(
      `Failed to send verification email to ${email}: ${emailError.message}`
    );
  }

  logger.info(`New user registered: ${username}`);
  return user;
};

/**
 * Inicia sesión y genera tokens
 * @param {string} identifier - Username o email
 * @param {string} password - Contraseña del usuario
 * @returns {Object} - Objeto con accessToken, refreshToken y datos del usuario, o require2FA si tiene 2FA activo
 */
export const loginUser = async (identifier, password) => {
  // Buscar por username o email
  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  // Verificar contraseña
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Credenciales inválidas');
  }

  // Si el usuario tiene 2FA activado, devolver tempToken en lugar de tokens finales
  if (user.isTwoFactorEnabled) {
    const twoFactorService = await import('./twoFactorService.js');
    const tempToken = await twoFactorService.generateTempToken(user);

    logger.info(`User ${user.username} requires 2FA verification`);

    return {
      require2FA: true,
      tempToken,
    };
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
    throw new Error('Refresh token inválido o expirado');
  }

  // Obtener usuario de la base de datos
  const user = await User.findById(tokenData.userId);

  if (!user) {
    throw new Error('Usuario no encontrado');
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
 * @param {string} accessToken - Access token a revocar (opcional, puede estar caducado)
 * @returns {boolean} - true si se revocó correctamente
 */
export const logoutUser = async (refreshToken, accessToken) => {
  // Intentar revocar access token primero (best effort - puede estar caducado)
  if (accessToken) {
    try {
      const accessSuccess = await tokenService.revokeToken(
        accessToken,
        'access'
      );
      if (accessSuccess) {
        logger.info('Access token revoked successfully');
      } else {
        logger.warn('Access token not found or already expired/revoked');
      }
    } catch (error) {
      // No es crítico si falla - puede estar caducado
      logger.warn(
        `Failed to revoke access token (non-critical): ${error.message}`
      );
    }
  }

  // Revocar refresh token (este es el crítico)
  const refreshSuccess = await tokenService.revokeToken(
    refreshToken,
    'refresh'
  );

  if (!refreshSuccess) {
    throw new Error('Refresh token no encontrado');
  }

  logger.info('User logged out successfully');
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

/**
 * Verifica el email del usuario usando el token de verificación
 * @param {string} token - Token de verificación
 * @returns {Object} - Usuario actualizado
 */
export const verifyEmail = async (token) => {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error('Token de verificación inválido o expirado');
  }

  // Marcar email como verificado y limpiar tokens
  user.emailVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  try {
    await emailService.sendWelcomeEmail({
      email: user.email,
      username: user.username,
    });
  } catch (emailError) {
    logger.error(`Failed to send welcome email: ${emailError.message}`);
  }

  logger.info(`Email verified for user: ${user.username}`);
  return user;
};

/**
 * Reenvía el correo de verificación con un nuevo token
 * @param {string} email - Email del usuario
 * @returns {Object} - Resultado del reenvío
 */
export const resendVerificationEmail = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (user.emailVerified) {
    throw new Error('Email ya verificado');
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = verificationExpires;
  await user.save();

  await emailService.sendVerificationEmail({
    email: user.email,
    username: user.username,
    verificationToken,
  });

  logger.info(`Verification email resent to: ${user.email}`);
  return { message: 'Email de verificación enviado' };
};

/**
 * Solicita el restablecimiento de contraseña
 * @param {string} email - Email del usuario
 * @returns {Object} - Resultado de la solicitud
 */
export const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    logger.info(`Password reset requested for non-existent email: ${email}`);
    return {
      message: 'Si el email existe, se enviará un enlace de restablecimiento',
    };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  user.passwordResetToken = resetToken;
  user.passwordResetExpires = resetExpires;
  await user.save();

  try {
    await emailService.sendPasswordResetEmail({
      email: user.email,
      username: user.username,
      resetToken,
    });
    logger.info(`Password reset email sent to: ${user.email}`);
  } catch (emailError) {
    logger.error(`Failed to send password reset email: ${emailError.message}`, {
      error: emailError,
    });
  }

  return {
    message:
      'Si el email existe, se enviará un enlace para reestablecer la contraseña',
  };
};

/**
 * Restablece la contraseña usando el token de reset
 * @param {string} token - Token de restablecimiento
 * @param {string} newPassword - Nueva contraseña
 * @returns {Object} - Resultado del restablecimiento
 */
export const resetPassword = async (token, newPassword) => {
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error('Token de restablecimiento inválido o expirado');
  }

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  await tokenService.revokeAllUserTokens(user._id.toString());

  try {
    await emailService.sendPasswordChangedEmail({
      email: user.email,
      username: user.username,
    });
  } catch (emailError) {
    logger.error(
      `Failed to send password changed confirmation: ${emailError.message}`
    );
  }

  logger.info(`Password reset successfully for user: ${user.username}`);
  return { message: 'Contraseña restablecida exitosamente' };
};

/**
 * Cambia la contraseña de un usuario autenticado
 * @param {string} userId - ID del usuario
 * @param {string} currentPassword - Contraseña actual
 * @param {string} newPassword - Nueva contraseña
 * @returns {Object} - Mensaje de éxito
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new Error('Contraseña actual incorrecta');
  }

  if (newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
  }

  user.password = newPassword;
  await user.save();

  try {
    await emailService.sendPasswordChangedEmail({
      email: user.email,
      username: user.username,
    });
  } catch (emailError) {
    logger.warn(
      `Failed to send password changed notification: ${emailError.message}`
    );
  }

  logger.info(`Password changed for user: ${user.username}`);
  return { message: 'Contraseña cambiada exitosamente' };
};

/**
 * Elimina permanentemente una cuenta de usuario y todos sus datos asociados
 * @param {string} userId - ID del usuario a eliminar
 * @returns {Object} - Resultado de la eliminación
 */
export const deleteUserAccount = async (userId) => {
  // Import Profile here to avoid circular dependencies
  const Profile = (await import('../models/Profile.js')).default;

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const { email, username } = user;

  logger.info(`Starting account deletion for user: ${userId} (${username})`);

  try {
    await tokenService.revokeAllUserTokens(userId);
    logger.info(`All tokens revoked for user: ${userId}`);
  } catch (err) {
    logger.warn(`Failed to revoke tokens for user ${userId}: ${err.message}`);
  }

  try {
    await Profile.deleteOne({ userId });
    logger.info(`Profile deleted for user: ${userId}`);
  } catch (err) {
    logger.warn(`Failed to delete profile for user ${userId}: ${err.message}`);
  }

  await User.deleteOne({ _id: userId });
  logger.info(`User deleted: ${userId}`);

  await publishUserEvent('USER_DELETED', {
    userId,
    email,
    username,
    reason: 'user_request',
    deletedAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Cuenta eliminada exitosamente',
    deletedUserId: userId,
  };
};
