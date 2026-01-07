import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Apply requireAdmin middleware to all routes in this router
router.use(requireAdmin);

/**
 * @swagger
 * /api/v1/admin/create-admin:
 *   post:
 *     summary: Crea un nuevo usuario administrador
 *     description: |
 *       Crea un nuevo usuario con rol de administrador.
 *       Solo accesible por administradores existentes.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Nombre de usuario único
 *                 example: admin_user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email único del administrador
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Contraseña del administrador
 *                 example: secureAdminPass123
 *     responses:
 *       201:
 *         description: Administrador creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Administrador creado exitosamente
 *       400:
 *         description: Campos faltantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: MISSING_FIELDS
 *                 message:
 *                   type: string
 *                   example: Se necesitan el nombre de usuario, email y contraseña
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       409:
 *         description: Usuario o email ya existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: DUPLICATE_ENTRY
 *                 message:
 *                   type: string
 *                   example: El usuario ya existe
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: CREATION_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al crear el administrador
 */
router.post('/create-admin', adminController.createAdmin);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Lista todos los usuarios
 *     description: Obtiene una lista de todos los usuarios registrados en el sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: ID del usuario
 *                     example: 507f1f77bcf86cd799439011
 *                   username:
 *                     type: string
 *                     example: john_doe
 *                   email:
 *                     type: string
 *                     example: john@example.com
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["beatmaker"]
 *                   emailVerified:
 *                     type: boolean
 *                     example: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: FETCH_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al obtener los usuarios
 */
router.get('/users', adminController.listUsers);

/**
 * @swagger
 * /api/v1/admin/users/username/{username}:
 *   get:
 *     summary: Obtiene un usuario por su username
 *     description: Busca y devuelve los detalles de un usuario específico por su nombre de usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de usuario a buscar
 *         example: john_doe
 *     responses:
 *       200:
 *         description: Detalles del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439011
 *                 username:
 *                   type: string
 *                   example: john_doe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["beatmaker"]
 *                 emailVerified:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: USER_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: FETCH_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al obtener el usuario
 */
router.get('/users/username/:username', adminController.getUserByUsername);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Obtiene un usuario por su ID
 *     description: Busca y devuelve los detalles de un usuario específico por su ID de MongoDB
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB del usuario
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Detalles del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439011
 *                 username:
 *                   type: string
 *                   example: john_doe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["beatmaker"]
 *                 emailVerified:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: USER_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: FETCH_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al obtener el usuario
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @swagger
 * /api/v1/admin/users/{username}:
 *   put:
 *     summary: Actualiza un usuario por su username
 *     description: Permite a un administrador actualizar cualquier campo de un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de usuario a actualizar
 *         example: john_doe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Nuevo email
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Nuevos roles del usuario
 *               emailVerified:
 *                 type: boolean
 *                 description: Estado de verificación del email
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuario actualizado exitosamente
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: USER_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: UPDATE_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al actualizar el usuario
 */
router.put('/users/:username', adminController.updateUser);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Elimina un usuario por su ID
 *     description: |
 *       Elimina permanentemente un usuario del sistema.
 *       Esta acción es irreversible.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB del usuario a eliminar
 *         example: 507f1f77bcf86cd799439011
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
 *                   example: Usuario eliminado exitosamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Prohibido (requiere rol de administrador)
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: USER_NOT_FOUND
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: DELETE_FAILED
 *                 message:
 *                   type: string
 *                   example: Error al eliminar el usuario
 */
router.delete('/users/:id', adminController.deleteUser);

export default (app) => {
  app.use('/api/v1/admin', router);
};
