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
        message: 'Se necesita el nombre de usuario, email y contraseña',
        details: {
          username: !username ? 'Introduzca el nombre de usuario' : undefined,
          email: !email ? 'Introduzca el email' : undefined,
          password: !password ? 'Introduzca la contraseña' : undefined,
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
        message: 'El nombre de usuario, email y contraseña deben ser texto',
      });
    }

    // Validación 3: Longitud de campos
    if (username.trim().length < 3) {
      return res.status(400).json({
        error: 'INVALID_USERNAME',
        message: 'El nombre de usuario debe tener al menos 3 caracteres',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    // Validación 4: Formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'El formato del email no es válido',
      });
    }

    await authService.registerUser({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      roles: ['beatmaker'],
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);

    // Error de usuario o email duplicado
    if (error.message.includes('Username already exists')) {
      return res.status(409).json({
        error: 'USERNAME_EXISTS',
        message: 'El nombre de usuario ya existe',
      });
    }

    if (error.message.includes('Email already exists')) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'El email ya está registrado',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Error en el registro',
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
        message: 'Se necesita el identificador y contraseña',
        details: {
          identifier: !identifier
            ? 'Introduzca el identificador (usuario o email)'
            : undefined,
          password: !password ? 'Introduzca la contraseña' : undefined,
        },
      });
    }

    // Validación 2: Tipos de datos
    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El identificador y contraseña deben ser texto',
      });
    }

    // Validación 3: Campos no vacíos
    if (identifier.trim().length === 0 || password.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_FIELDS',
        message: 'El identificador y contraseña no pueden estar vacíos',
      });
    }

    const result = await authService.loginUser(identifier.trim(), password);

    // Si requiere 2FA, devolver 202 con tempToken
    if (result.require2FA) {
      return res.status(202).json({
        message: 'Se requiere verificación 2FA',
        require2FA: true,
        tempToken: result.tempToken,
      });
    }

    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);

    // Error de credenciales inválidas
    if (error.message === 'Credenciales inválidas') {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message:
          'Credenciales inválidas, el identificador y/o la contraseña son incorrectos',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'LOGIN_FAILED',
      message: 'Error en el inicio de sesión',
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
        message: 'Se necesita el refresh token',
      });
    }

    // Validación 2: Tipo de dato
    if (typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El refresh token debe ser texto',
      });
    }

    // Validación 3: Campo no vacío
    if (refreshToken.trim().length === 0) {
      return res.status(400).json({
        error: 'EMPTY_REFRESH_TOKEN',
        message: 'El refresh token no puede estar vacío',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      message: 'Token actualizado exitosamente',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);

    // Error de token inválido o expirado
    if (
      error.message.includes('inválido') ||
      error.message.includes('expirado')
    ) {
      return res.status(401).json({
        error: 'INVALID_REFRESH_TOKEN',
        message: error.message,
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'REFRESH_FAILED',
      message: 'Error al actualizar el token',
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
        message: 'Se necesita el refresh token',
      });
    }

    // Validación 2: Tipo de dato
    if (typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'Refresh token debe ser texto',
      });
    }

    // Validación 3: Access token si se proporciona
    if (accessToken && typeof accessToken !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El access token debe ser texto',
      });
    }

    await authService.logoutUser(refreshToken, accessToken);

    res.status(200).json({
      message: 'Sesión cerrada exitosamente',
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);

    // Error de token no encontrado
    if (error.message === 'Refresh token no encontrado') {
      return res.status(404).json({
        error: 'TOKEN_NOT_FOUND',
        message: 'Refresh token no encontrado',
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'LOGOUT_FAILED',
      message: 'Error al cerrar sesión',
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
        message: 'Autenticación requerida',
      });
    }

    const revokedCount = await authService.revokeAllUserTokens(userId);

    res.status(200).json({
      message: 'Todos los tokens han sido revocados exitosamente',
      revokedCount,
    });
  } catch (error) {
    logger.error(`Revoke all tokens error: ${error.message}`);
    res.status(500).json({
      error: 'REVOKE_FAILED',
      message: 'Error al revocar los tokens',
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'MISSING_TOKEN',
        message: 'Se necesita el token de verificación',
      });
    }

    if (typeof token !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El token debe ser texto',
      });
    }

    const user = await authService.verifyEmail(token);

    res.status(200).json({
      message: 'Email verificado exitosamente',
      emailVerified: true,
      username: user.username,
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);

    if (
      error.message.includes('inválido') ||
      error.message.includes('expirado')
    ) {
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'VERIFICATION_FAILED',
      message: 'Error en la verificación del email',
    });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Se necesita el email',
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El email debe ser texto',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Formato de email inválido',
      });
    }

    await authService.resendVerificationEmail(email);

    res.status(200).json({
      message: 'Email de verificación enviado exitosamente',
    });
  } catch (error) {
    logger.error(`Resend verification email error: ${error.message}`);

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (error.message === 'Email ya verificado') {
      return res.status(400).json({
        error: 'ALREADY_VERIFIED',
        message: 'El email ya está verificado',
      });
    }

    res.status(500).json({
      error: 'RESEND_FAILED',
      message: 'Error al reenviar el email de verificación',
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Se necesita el email',
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El email debe ser texto',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Formato de email inválido',
      });
    }

    await authService.requestPasswordReset(email);

    res.status(200).json({
      message:
        'Si el email existe, se enviará un enlace para reestablecer la contraseña',
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);

    res.status(200).json({
      message:
        'Si el email existe, se enviará un enlace para reestablecer la contraseña',
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Se necesita el token y la contraseña',
        details: {
          token: !token
            ? 'Se necesita el token de restablecimiento'
            : undefined,
          password: !password ? 'Se necesita la nueva contraseña' : undefined,
        },
      });
    }

    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'INVALID_DATA_TYPE',
        message: 'El token y contraseña deben ser texto',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    await authService.resetPassword(token, password);

    res.status(200).json({
      message: 'Contraseña restablecida exitosamente',
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);

    if (
      error.message.includes('inválido') ||
      error.message.includes('expirado')
    ) {
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'RESET_FAILED',
      message: 'Error al restablecer la contraseña',
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
        message: 'Se necesita autenticación',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Se necesita la contraseña actual y la nueva',
        details: {
          currentPassword: !currentPassword
            ? 'Introduzca la contraseña actual'
            : undefined,
          newPassword: !newPassword
            ? 'Introduzca la nueva contraseña'
            : undefined,
        },
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'La nueva contraseña debe tener al menos 6 caracteres',
      });
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      message: 'Contraseña cambiada exitosamente',
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);

    if (error.message === 'Contraseña actual incorrecta') {
      return res.status(401).json({
        error: 'INCORRECT_PASSWORD',
        message: 'La contraseña actual es incorrecta',
      });
    }

    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    res.status(500).json({
      error: 'CHANGE_PASSWORD_FAILED',
      message: 'Error al cambiar la contraseña',
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
        message: 'Se necesita el ID del usuario',
      });
    }

    // Validar formato de ObjectId (24 caracteres hex)
    const objectIdRegex = /^[a-fA-F0-9]{24}$/;
    if (!objectIdRegex.test(userId)) {
      return res.status(400).json({
        error: 'INVALID_USER_ID',
        message: 'Formato de ID de usuario inválido',
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
        message: 'Usuario no encontrado',
      });
    }

    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Error al eliminar la cuenta de usuario',
    });
  }
};
