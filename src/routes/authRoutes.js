import express from 'express';
import * as authController from '../controllers/authController.js';
import {
  requireAdmin,
  requireBeatmaker,
} from '../middlewares/roleMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registra un nuevo usuario como beatmaker
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
 *                 minLength: 3
 *                 description: Nombre de usuario (único, mínimo 3 caracteres)
 *                 example: john_doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario (único)
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Contraseña (mínimo 6 caracteres)
 *                 example: mySecurePassword123
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_FIELDS, INVALID_DATA_TYPE, INVALID_USERNAME, INVALID_PASSWORD, INVALID_EMAIL]
 *                   example: INVALID_EMAIL
 *                 message:
 *                   type: string
 *                   example: Email format is invalid
 *                 details:
 *                   type: object
 *                   description: Detalles específicos del error (solo para MISSING_FIELDS)
 *       409:
 *         description: Usuario o email ya existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [USERNAME_EXISTS, EMAIL_EXISTS]
 *                   example: USERNAME_EXISTS
 *                 message:
 *                   type: string
 *                   example: Username already exists
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: REGISTRATION_FAILED
 *                 message:
 *                   type: string
 *                   example: Registration failed
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Inicia sesión y obtiene tokens de acceso
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
 *                 description: Username o email del usuario
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *                 example: mySecurePassword123
 *     responses:
 *       200:
 *         description: Login exitoso con tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 accessToken:
 *                   type: string
 *                   description: Token de acceso (JWT, expira en 15 minutos)
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   description: Token de actualización (expira en 7 días)
 *                   example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_FIELDS, INVALID_DATA_TYPE, EMPTY_FIELDS]
 *                   example: MISSING_FIELDS
 *                 message:
 *                   type: string
 *                   example: Identifier and password are required
 *                 details:
 *                   type: object
 *                   description: Detalles específicos del error
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: INVALID_CREDENTIALS
 *                 message:
 *                   type: string
 *                   example: Invalid credentials
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: LOGIN_FAILED
 *                 message:
 *                   type: string
 *                   example: Login failed
 */
router.post('/login', authController.login);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Mensaje de éxito
 *                 accessToken:
 *                   type: string
 *                   description: Nuevo access token
 *                 refreshToken:
 *                   type: string
 *                   description: Nuevo refresh token (rotado)
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Cierra sesión revocando tokens (refresh y opcionalmente access)
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
 *                 description: Refresh token a revocar (requerido)
 *                 example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *               accessToken:
 *                 type: string
 *                 description: Access token a revocar (opcional, recomendado)
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Logout exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_REFRESH_TOKEN, INVALID_DATA_TYPE]
 *                   example: MISSING_REFRESH_TOKEN
 *                 message:
 *                   type: string
 *                   example: Refresh token is required
 *       404:
 *         description: Token no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: TOKEN_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Refresh token not found
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: LOGOUT_FAILED
 *                 message:
 *                   type: string
 *                   example: Logout failed
 */
router.post('/logout', authController.logout);

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
router.post('/revoke-all', authController.revokeAll);

export default (app) => {
  app.use('/api/v1/auth', router);
};
