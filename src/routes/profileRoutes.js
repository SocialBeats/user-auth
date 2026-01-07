import express from 'express';
import * as profileController from '../controllers/profileController.js';
import {
  requireAdmin,
  requireBeatmaker,
} from '../middlewares/roleMiddleware.js';
import { requireInternalApiKey } from '../middlewares/internalMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/v1/profile/internal/{userId}/verification-status:
 *   put:
 *     tags:
 *       - Internal
 *     summary: Actualizar estado de verificación (Interno)
 *     description: |
 *       Endpoint protegido por API Key interna para actualizar estado de verificación desde FaaS/Webhooks.
 *       Usado por el sistema de verificación de identidad (Persona).
 *     parameters:
 *       - in: header
 *         name: x-internal-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key interna para autenticación entre microservicios
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario (MongoDB ObjectId)
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [VERIFICADO, PENDING, REJECTED]
 *                 description: Nuevo estado de verificación
 *               provider_id:
 *                 type: string
 *                 description: ID del proveedor de verificación (Persona)
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Estado de verificación actualizado correctamente
 *       401:
 *         description: API Key interna inválida o faltante
 *       404:
 *         description: Perfil de usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Perfil de usuario no encontrado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error interno del servidor
 */
router.put(
  '/internal/:userId/verification-status',
  requireInternalApiKey,
  profileController.updateVerificationStatus
);

/**
 * @openapi
 * /api/v1/profile/me:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Obtener mi perfil
 *     description: Obtiene el perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 about_me:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 full_name:
 *                   type: string
 *                 contact:
 *                   type: object
 *                 studies:
 *                   type: array
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 certifications:
 *                   type: array
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil no encontrado
 */
router.get('/me', profileController.getMyProfile);

/**
 * @openapi
 * /api/v1/profile/me/completion-status:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Obtener estado de completitud del perfil
 *     description: Obtiene el progreso de completitud del perfil por pasos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de completitud obtenido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       label:
 *                         type: string
 *                       required:
 *                         type: boolean
 *                       completed:
 *                         type: boolean
 *                 completionPercentage:
 *                   type: integer
 *                 verificationLevel:
 *                   type: string
 *                   enum: [none, basic, advanced, verified]
 *                 nextStep:
 *                   type: object
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil no encontrado
 */
router.get('/me/completion-status', profileController.getCompletionStatus);

/**
 * @openapi
 * /api/v1/profile/me:
 *   put:
 *     tags:
 *       - Profile
 *     summary: Actualizar mi perfil
 *     description: Actualiza el perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               about_me:
 *                 type: string
 *               avatar:
 *                 type: string
 *               full_name:
 *                 type: string
 *               contact:
 *                 type: object
 *                 properties:
 *                   phone:
 *                     type: string
 *                   city:
 *                     type: string
 *                   country:
 *                     type: string
 *                   website:
 *                     type: string
 *                   social_media:
 *                     type: object
 *               studies:
 *                 type: array
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               certifications:
 *                 type: array
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil no encontrado
 */
router.put('/me', profileController.updateMyProfile);

/**
 * @openapi
 * /api/v1/profile/me:
 *   delete:
 *     tags:
 *       - Profile
 *     summary: Eliminar mi cuenta permanentemente
 *     description: |
 *       Elimina permanentemente la cuenta del usuario autenticado.
 *       Esta acción es IRREVERSIBLE. Elimina:
 *       - La cuenta del usuario (User)
 *       - El perfil asociado (Profile)
 *       - Revoca todos los tokens activos
 *       - Publica evento Kafka `USER_DELETED` para limpieza en otros microservicios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuenta eliminada exitosamente
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
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete('/me', profileController.deleteMyProfile);

/**
 * @openapi
 * /api/v1/profile:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Explorar todos los perfiles
 *     description: Obtiene una lista paginada de todos los perfiles públicos
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Número de resultados por página
 *     responses:
 *       200:
 *         description: Lista de perfiles obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       username:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 8
 *                     limit:
 *                       type: integer
 *                       example: 20
 *       500:
 *         description: Error del servidor
 */
router.get('/', profileController.getAllProfiles);

/**
 * @openapi
 * /api/v1/profile/search:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Buscar perfiles
 *     description: Busca perfiles por username, nombre completo o email
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Término de búsqueda (username, email, nombre)
 *         example: john
 *     responses:
 *       200:
 *         description: Lista de perfiles encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         example: 507f1f77bcf86cd799439011
 *                       username:
 *                         type: string
 *                         example: john_doe
 *                       full_name:
 *                         type: string
 *                         example: John Doe
 *                       avatar:
 *                         type: string
 *                         example: https://cdn.example.com/avatars/john.jpg
 *                       email:
 *                         type: string
 *                         example: john@example.com
 *       400:
 *         description: Término de búsqueda faltante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: MISSING_SEARCH_TERM
 *                 message:
 *                   type: string
 *                   example: El término de búsqueda (q) es requerido
 *       500:
 *         description: Error del servidor
 */
router.get('/search', profileController.searchProfiles);

/**
 * @openapi
 * /api/v1/profile/{identifier}:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Obtener perfil por userId o username
 *     description: |
 *       Obtiene el perfil público de un usuario.
 *       Detecta automáticamente si el parámetro es un userId (ObjectId de 24 caracteres hex) o un username.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: userId (ObjectId) o username del usuario
 *         example: john_doe
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439011
 *                 username:
 *                   type: string
 *                   example: john_doe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 about_me:
 *                   type: string
 *                   example: Soy un beatmaker de Madrid
 *                 avatar:
 *                   type: string
 *                   example: https://cdn.example.com/avatars/john.jpg
 *                 banner:
 *                   type: string
 *                   example: https://cdn.example.com/banners/john.jpg
 *                 full_name:
 *                   type: string
 *                   example: John Doe
 *                 contact:
 *                   type: object
 *                 studies:
 *                   type: array
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 certifications:
 *                   type: array
 *                 identityVerified:
 *                   type: boolean
 *                   example: false
 *                 verificationLevel:
 *                   type: string
 *                   enum: [none, verified]
 *                   example: none
 *       404:
 *         description: Perfil no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: PROFILE_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Perfil no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:identifier', profileController.getProfileByIdentifier);

export default (app) => {
  app.use('/api/v1/profile', router);
};
