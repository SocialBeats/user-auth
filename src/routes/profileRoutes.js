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
 *     description: Endpoint protegido por API Key interna para actualizar estado de verificación desde FaaS/Webhooks.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [VERIFICADO, PENDING, REJECTED]
 *               provider_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       401:
 *         description: Invalid Internal API Key
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
 *     summary: Eliminar mi perfil
 *     description: Elimina el perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil eliminado exitosamente
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil no encontrado
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
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Número de resultados por página
 *     responses:
 *       200:
 *         description: Lista de perfiles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
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
 *         description: Término de búsqueda (username, email, nombre)
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
 *                       username:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                       email:
 *                         type: string
 *       400:
 *         description: Término de búsqueda faltante
 */
router.get('/search', profileController.searchProfiles);

/**
 * @openapi
 * /api/v1/profile/{identifier}:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Obtener perfil por userId o username
 *     description: Obtiene el perfil público de un usuario. Detecta automáticamente si el parámetro es un userId (ObjectId de 24 caracteres) o un username.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: userId (ObjectId) o username del usuario
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
 *       404:
 *         description: Perfil no encontrado
 */
router.get('/:identifier', profileController.getProfileByIdentifier);

export default (app) => {
  app.use('/api/v1/profile', router);
};
