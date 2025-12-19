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

/**
 * Controlador para buscar usuarios
 */
