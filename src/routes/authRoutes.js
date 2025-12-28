import express from 'express';
import * as authController from '../controllers/authController.js';
import * as tokenValidationController from '../controllers/tokenValidationController.js';
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

/**
 * @swagger
 * /api/v1/auth/validate-token:
 *   post:
 *     summary: Valida un access token contra Redis (usado por API Gateway)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Access token a validar
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.post('/validate-token', tokenValidationController.validateToken);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   get:
 *     summary: Verifica el email del usuario usando un token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificación enviado por email
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *                 emailVerified:
 *                   type: boolean
 *                   example: true
 *                 username:
 *                   type: string
 *                   example: john_doe
 *       400:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_TOKEN, INVALID_TOKEN]
 *                 message:
 *                   type: string
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Reenvía el email de verificación
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Email de verificación reenviado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email sent successfully
 *       400:
 *         description: Email ya verificado o formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_EMAIL, INVALID_EMAIL, ALREADY_VERIFIED]
 *                 message:
 *                   type: string
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/resend-verification', authController.resendVerificationEmail);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Solicita el restablecimiento de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Solicitud procesada (siempre devuelve éxito por seguridad)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: If the email exists, a reset link will be sent
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Restablece la contraseña usando un token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de restablecimiento enviado por email
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Nueva contraseña (mínimo 6 caracteres)
 *                 example: myNewSecurePassword123
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
 *       400:
 *         description: Token inválido, expirado, o contraseña inválida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_FIELDS, INVALID_TOKEN, INVALID_PASSWORD]
 *                 message:
 *                   type: string
 */
router.post('/reset-password', authController.resetPassword);

export default (app) => {
  app.use('/api/v1/auth', router);
};
