import logger from '../../logger.js';
import * as authService from '../services/authService.js';

/**
 * Controlador para registrar un nuevo usuario
 */
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validación 1: Campos requeridos
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Username, email and password are required',
        details: {
          username: !username ? 'Username is required' : undefined,
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
        },
      });
    }

    // Validación 2: Tipos de datos
    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Username, email and password must be strings',
      });
    }

    // Validación 3: Longitud de campos
    if (username.trim().length < 3) {
      return res.status(400).json({
        error: 'INVALID_USERNAME',
        message: 'Username must be at least 3 characters long',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Password must be at least 6 characters long',
      });
    }

    // Validación 4: Formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Email format is invalid',
      });
    }

    await authService.registerUser({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      roles: ['beatmaker'],
    });

    res.status(201).json({
      message: 'User registered successfully',
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);

    // Error de usuario o email duplicado
    if (error.message.includes('Username already exists')) {
      return res.status(409).json({
        error: 'USERNAME_EXISTS',
        message: 'Username already exists',
      });
    }

    if (error.message.includes('Email already exists')) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'Email already exists',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Registration failed',
    });
  }
};

/**
 * Controlador para iniciar sesión
 */
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Validación 1: Campos requeridos
    if (!identifier || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Identifier and password are required',
        details: {
          identifier: !identifier
            ? 'Identifier (username or email) is required'
            : undefined,
          password: !password ? 'Password is required' : undefined,
        },
      });
    }

    // Validación 2: Tipos de datos
    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Identifier and password must be strings',
      });
    }

    // Validación 3: Campos no vacíos
    if (identifier.trim().length === 0 || password.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_FIELDS',
        message: 'Identifier and password cannot be empty',
      });
    }

    const result = await authService.loginUser(identifier.trim(), password);

    // Si requiere 2FA, devolver 202 con tempToken
    if (result.require2FA) {
      return res.status(202).json({
        message: '2FA verification required',
        require2FA: true,
        tempToken: result.tempToken,
      });
    }

    res.status(200).json({
      message: 'Login successful',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);

    // Error de credenciales inválidas
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'LOGIN_FAILED',
      message: 'Login failed',
    });
  }
};

/**
 * Controlador para refrescar el access token
 */
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Validación 1: Campo requerido
    if (!refreshToken) {
      return res.status(400).json({
        error: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    // Validación 2: Tipo de dato
    if (typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Refresh token must be a string',
      });
    }

    // Validación 3: Campo no vacío
    if (refreshToken.trim().length === 0) {
      return res.status(400).json({
        error: 'EMPTY_REFRESH_TOKEN',
        message: 'Refresh token cannot be empty',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);

    // Error de token inválido o expirado
    if (
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    ) {
      return res.status(401).json({
        error: 'INVALID_REFRESH_TOKEN',
        message: error.message,
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'REFRESH_FAILED',
      message: 'Token refresh failed',
    });
  }
};

/**
 * Controlador para cerrar sesión
 */
export const logout = async (req, res) => {
  try {
    const { refreshToken, accessToken } = req.body;

    // Validación 1: Campo requerido
    if (!refreshToken) {
      return res.status(400).json({
        error: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    // Validación 2: Tipo de dato
    if (typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Refresh token must be a string',
      });
    }

    // Validación 3: Access token si se proporciona
    if (accessToken && typeof accessToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Access token must be a string',
      });
    }

    await authService.logoutUser(refreshToken, accessToken);

    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);

    // Error de token no encontrado
    if (error.message === 'Refresh token not found') {
      return res.status(404).json({
        error: 'TOKEN_NOT_FOUND',
        message: 'Refresh token not found',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'LOGOUT_FAILED',
      message: 'Logout failed',
    });
  }
};

/**
 * Controlador para revocar todos los tokens de un usuario
 */
export const revokeAll = async (req, res) => {
  try {
    // El userId viene del token JWT verificado por el middleware
    const userId = req.user?.id;

    // Validación: Usuario autenticado
    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const revokedCount = await authService.revokeAllUserTokens(userId);

    res.status(200).json({
      message: 'All tokens revoked successfully',
      revokedCount,
    });
  } catch (error) {
    logger.error(`Revoke all tokens error: ${error.message}`);
    res.status(500).json({
      error: 'REVOKE_FAILED',
      message: 'Failed to revoke tokens',
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'MISSING_TOKEN',
        message: 'Verification token is required',
      });
    }

    if (typeof token !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Token must be a string',
      });
    }

    const user = await authService.verifyEmail(token);

    res.status(200).json({
      message: 'Email verified successfully',
      emailVerified: true,
      username: user.username,
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);

    if (
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    ) {
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'VERIFICATION_FAILED',
      message: 'Email verification failed',
    });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Email must be a string',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Email format is invalid',
      });
    }

    await authService.resendVerificationEmail(email);

    res.status(200).json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    logger.error(`Resend verification email error: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (error.message === 'Email already verified') {
      return res.status(400).json({
        error: 'ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }

    res.status(500).json({
      error: 'RESEND_FAILED',
      message: 'Failed to resend verification email',
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Email must be a string',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Email format is invalid',
      });
    }

    await authService.requestPasswordReset(email);

    res.status(200).json({
      message: 'If the email exists, a reset link will be sent',
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);

    res.status(200).json({
      message: 'If the email exists, a reset link will be sent',
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Token and password are required',
        details: {
          token: !token ? 'Reset token is required' : undefined,
          password: !password ? 'New password is required' : undefined,
        },
      });
    }

    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Token and password must be strings',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Password must be at least 6 characters long',
      });
    }

    await authService.resetPassword(token, password);

    res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);

    if (
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    ) {
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'RESET_FAILED',
      message: 'Password reset failed',
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Current password and new password are required',
        details: {
          currentPassword: !currentPassword
            ? 'Current password is required'
            : undefined,
          newPassword: !newPassword ? 'New password is required' : undefined,
        },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'New password must be at least 8 characters long',
      });
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);

    if (error.message === 'Current password is incorrect') {
      return res.status(401).json({
        error: 'INCORRECT_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    res.status(500).json({
      error: 'CHANGE_PASSWORD_FAILED',
      message: 'Failed to change password',
    });
  }
};

/**
 * Controlador interno para eliminar una cuenta de usuario
 * Protegido por x-internal-api-key (no requiere JWT)
 * El userId se recibe como parámetro de ruta
 */
export const deleteUserInternal = async (req, res) => {
  try {
    const { id: userId } = req.params;

    // Validación: userId requerido
    if (!userId) {
      return res.status(400).json({
        error: 'MISSING_USER_ID',
        message: 'User ID is required',
      });
    }

    // Validar formato de ObjectId (24 caracteres hex)
    const objectIdRegex = /^[a-fA-F0-9]{24}$/;
    if (!objectIdRegex.test(userId)) {
      return res.status(400).json({
        error: 'INVALID_USER_ID',
        message: 'Invalid user ID format',
      });
    }

    const result = await authService.deleteUserAccount(userId);

    res.status(200).json({
      message: result.message,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Internal delete user error: ${error.message}`);

    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete user account',
    });
  }
};
