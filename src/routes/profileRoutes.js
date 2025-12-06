import express from 'express';
import * as profileController from '../controllers/profileController.js';
import {
  requireAdmin,
  requireBeatmaker,
} from '../middlewares/roleMiddleware.js';

const router = express.Router();

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
 * /api/v1/profile/{username}:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Obtener perfil por username
 *     description: Obtiene el perfil público de un usuario por su username
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username del usuario
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *       404:
 *         description: Perfil no encontrado
 */
router.get('/:username', requireAdmin, profileController.getProfileByUsername);

export default (app) => {
  app.use('/api/v1/profile', router);
};
