import express from 'express';
import * as twoFactorController from '../controllers/twoFactorController.js';
import { requireBeatmaker } from '../middlewares/roleMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/2fa/status:
 *   get:
 *     summary: Obtiene el estado de 2FA del usuario
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de 2FA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                   example: false
 *       401:
 *         description: No autenticado
 */
router.get('/status', requireBeatmaker, twoFactorController.get2FAStatus);

/**
 * @swagger
 * /api/v1/auth/2fa/setup:
 *   post:
 *     summary: Inicia la configuración de 2FA
 *     description: Genera el secreto TOTP y el código QR para escanear
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Setup iniciado con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2FA setup initiated
 *                 secret:
 *                   type: string
 *                   description: Secreto TOTP para introducir manualmente
 *                   example: JBSWY3DPEHPK3PXP
 *                 qrCode:
 *                   type: string
 *                   description: QR code en formato data URL (base64)
 *                 otpauthUrl:
 *                   type: string
 *                   description: URL otpauth para configuración manual
 *       400:
 *         description: 2FA ya está activado
 *       401:
 *         description: No autenticado
 */
router.post('/setup', requireBeatmaker, twoFactorController.setup2FA);

/**
 * @swagger
 * /api/v1/auth/2fa/enable:
 *   post:
 *     summary: Activa 2FA después de verificar un código
 *     description: Verifica el código OTP y activa 2FA, devuelve códigos de backup
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código OTP de 6 dígitos
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA activado con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2FA enabled successfully
 *                 enabled:
 *                   type: boolean
 *                   example: true
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Códigos de backup de un solo uso
 *       400:
 *         description: Código inválido o 2FA ya activado
 *       401:
 *         description: No autenticado
 */
router.post('/enable', requireBeatmaker, twoFactorController.enable2FA);

/**
 * @swagger
 * /api/v1/auth/2fa/disable:
 *   post:
 *     summary: Desactiva 2FA
 *     description: Desactiva 2FA después de verificar un código OTP o backup
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código OTP de 6 dígitos o código de backup
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA desactivado con éxito
 *       400:
 *         description: Código inválido o 2FA no activado
 *       401:
 *         description: No autenticado
 */
router.post('/disable', requireBeatmaker, twoFactorController.disable2FA);

/**
 * @swagger
 * /api/v1/auth/2fa/backup-codes:
 *   get:
 *     summary: Obtiene los códigos de backup restantes
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Códigos de backup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 remaining:
 *                   type: integer
 *                   example: 8
 *       400:
 *         description: 2FA no activado
 *       401:
 *         description: No autenticado
 */
router.get(
  '/backup-codes',
  requireBeatmaker,
  twoFactorController.getBackupCodes
);

/**
 * @swagger
 * /api/v1/auth/2fa/regenerate-backup:
 *   post:
 *     summary: Regenera los códigos de backup
 *     description: Genera nuevos códigos de backup después de verificar código OTP
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código OTP de 6 dígitos
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Códigos regenerados con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Código inválido o 2FA no activado
 *       401:
 *         description: No autenticado
 */
router.post(
  '/regenerate-backup',
  requireBeatmaker,
  twoFactorController.regenerateBackupCodes
);

/**
 * @swagger
 * /api/v1/auth/2fa/verify:
 *   post:
 *     summary: Verifica el código 2FA durante el login
 *     description: Canjea el tempToken + código OTP por tokens de acceso
 *     tags: [2FA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tempToken
 *               - code
 *             properties:
 *               tempToken:
 *                 type: string
 *                 description: Token temporal recibido en el login
 *               code:
 *                 type: string
 *                 description: Código OTP de 6 dígitos o código de backup
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso
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
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Código o token inválido
 */
router.post('/verify', twoFactorController.verify2FA);

export default (app) => {
  app.use('/api/v1/auth/2fa', router);
};
