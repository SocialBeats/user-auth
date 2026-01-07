import express from 'express';

import * as authController from '../controllers/authController.js';
import * as tokenValidationController from '../controllers/tokenValidationController.js';
import {
  requireAdmin,
  requireBeatmaker,
} from '../middlewares/roleMiddleware.js';
import { requireInternalApiKey } from '../middlewares/internalMiddleware.js';

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
 *     description: Si el usuario tiene 2FA activado, devuelve 202 con tempToken para verificación
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
 *         description: Login exitoso con tokens (sin 2FA)
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
 *       202:
 *         description: Requiere verificación 2FA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2FA verification required
 *                 require2FA:
 *                   type: boolean
 *                   example: true
 *                 tempToken:
 *                   type: string
 *                   description: Token temporal para completar 2FA (expira en 5 minutos)
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
 *     description: Genera nuevos tokens de acceso usando el refresh token. Implementa rotación de refresh tokens.
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
 *                 description: Refresh token actual
 *                 example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *     responses:
 *       200:
 *         description: Nuevos tokens generados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token actualizado exitosamente
 *                 accessToken:
 *                   type: string
 *                   description: Nuevo access token (JWT)
 *                 refreshToken:
 *                   type: string
 *                   description: Nuevo refresh token (rotado)
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_REFRESH_TOKEN, INVALID_DATA_TYPE, EMPTY_REFRESH_TOKEN]
 *                   example: MISSING_REFRESH_TOKEN
 *                 message:
 *                   type: string
 *                   example: Se necesita el refresh token
 *       401:
 *         description: Refresh token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: INVALID_REFRESH_TOKEN
 *                 message:
 *                   type: string
 *                   example: El refresh token es inválido o ha expirado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: REFRESH_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al actualizar el token
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
 *     summary: Revoca todos los tokens de un usuario
 *     description: |
 *       Revoca todos los access y refresh tokens activos del usuario autenticado.
 *       Útil para cerrar sesión en todos los dispositivos.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todos los tokens revocados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Todos los tokens han sido revocados exitosamente
 *                 revokedCount:
 *                   type: integer
 *                   description: Número de tokens revocados
 *                   example: 5
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: AUTHENTICATION_REQUIRED
 *                 message:
 *                   type: string
 *                   example: Autenticación requerida
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: REVOKE_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al revocar los tokens
 */
router.post('/revoke-all', authController.revokeAll);

/**
 * @swagger
 * /api/v1/auth/validate-token:
 *   post:
 *     summary: Valida un access token contra Redis
 *     description: |
 *       Endpoint interno usado por el API Gateway para validar tokens.
 *       Verifica que el token no haya sido revocado en Redis.
 *       Devuelve siempre 200 con `valid: true/false`.
 *     tags: [Internal]
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
 *                 description: Access token (JWT) a validar
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Resultado de la validación (siempre devuelve 200)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: true si el token es válido, false si no
 *                 user:
 *                   type: object
 *                   description: Datos del usuario (solo si valid=true)
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     username:
 *                       type: string
 *                       example: john_doe
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["beatmaker"]
 *                 error:
 *                   type: string
 *                   description: Código de error (solo si valid=false)
 *                   enum: [MISSING_TOKEN, INVALID_TOKEN]
 *                 message:
 *                   type: string
 *                   description: Mensaje de error (solo si valid=false)
 *       400:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: MISSING_TOKEN
 *                 message:
 *                   type: string
 *                   example: Token no proporcionado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: VALIDATION_FAILED
 *                 message:
 *                   type: string
 *                   example: Error en la validación del token
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

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     summary: Cambia la contraseña del usuario autenticado
 *     description: Permite a un usuario cambiar su contraseña proporcionando la contraseña actual
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Contraseña actual
 *                 example: myCurrentPassword123
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Nueva contraseña (mínimo 8 caracteres)
 *                 example: myNewSecurePassword123
 *     responses:
 *       200:
 *         description: Contraseña cambiada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         description: Campos faltantes o contraseña inválida
 *       401:
 *         description: No autenticado o contraseña actual incorrecta
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/change-password', authController.changePassword);

/**
 * @swagger
 * /api/v1/auth/internal/user/{id}:
 *   delete:
 *     summary: Elimina un usuario (endpoint interno)
 *     description: |
 *       Endpoint protegido por x-internal-api-key para uso entre microservicios.
 *       Elimina permanentemente la cuenta del usuario, su perfil, revoca todos los tokens
 *       y publica evento Kafka USER_DELETED.
 *     tags: [Internal]
 *     parameters:
 *       - in: header
 *         name: x-internal-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key interna para autenticación entre microservicios
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a eliminar (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: ID de usuario inválido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [MISSING_USER_ID, INVALID_USER_ID]
 *                 message:
 *                   type: string
 *       401:
 *         description: API Key interna inválida o faltante
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete(
  '/internal/user/:id',
  requireInternalApiKey,
  authController.deleteUserInternal
);

export default (app) => {
  app.use('/api/v1/auth', router);
};
