import express from 'express';
import logger from '../../logger.js';
import * as authService from '../services/authService.js';
import {
  requireAdmin,
  requireBeatmaker,
} from '../middlewares/roleMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registra un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Usuario o email ya existe
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, roles } = req.body;

    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Username, email and password are required',
      });
    }

    const user = await authService.registerUser({
      username,
      email,
      password,
      roles,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Registration failed' });
  }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Inicia sesión y obtiene tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Username o email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso con tokens
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: 'Identifier and password are required',
      });
    }

    const result = await authService.loginUser(identifier, password);

    res.status(200).json({
      message: 'Login successful!!',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.status(500).json({ message: 'Login failed' });
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresca el access token usando un refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nuevo access token generado
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token is required',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    if (
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    ) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Cierra sesión revocando el refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout exitoso
 *       400:
 *         description: Refresh token no proporcionado
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token is required',
      });
    }

    await authService.logoutUser(refreshToken);

    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    if (error.message === 'Refresh token not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Logout failed' });
  }
});

/**
 * @swagger
 * /api/v1/auth/revoke-all:
 *   post:
 *     summary: Revoca todos los tokens de un usuario (requiere autenticación)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todos los tokens revocados
 *       401:
 *         description: No autenticado
 */
router.post('/revoke-all', async (req, res) => {
  try {
    // El userId viene del token JWT verificado por el middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
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
    res.status(500).json({ message: 'Failed to revoke tokens' });
  }
});

/**
 * @swagger
 * /api/v1/auth/users:
 *   get:
 *     summary: Lista todos los usuarios (solo admins)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos (requiere rol admin)
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    // Esta ruta solo es accesible para administradores
    // El middleware requireAdmin ya validó que el usuario tiene rol 'admin'

    // Aquí pondrías tu lógica para obtener usuarios
    // Por ejemplo: const users = await User.find().select('-password');

    res.status(200).json({
      message: 'Admin access granted',
      user: req.user.username,
      roles: req.user.roles,
      // users: users // descomentar cuando implementes la lógica
    });
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

router.get('/prueba', requireBeatmaker, async (req, res) => {
  try {
    res.status(200).json({
      message: 'Beatmaker access granted',
      user: req.user.username,
      roles: req.user.roles,
    });
  } catch (error) {
    logger.error(`Beatmaker access error: ${error.message}`);
    res.status(500).json({ message: 'Failed to access beatmaker route' });
  }
});

export default (app) => {
  app.use('/api/v1/auth', router);
};
