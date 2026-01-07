import { Router } from 'express';
import {
  getPresignedUrl,
  deleteCertification,
} from '../controllers/uploadController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/upload/presigned-url:
 *   get:
 *     summary: Obtiene una URL prefirmada para subir archivos a S3
 *     description: |
 *       Genera una URL prefirmada de S3 para subida directa desde el cliente.
 *       La URL expira en 60 segundos.
 *       Para certificaciones, valida el límite del plan del usuario.
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fileName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del archivo a subir
 *         example: mi_certificado.pdf
 *       - in: query
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo MIME del archivo
 *         example: application/pdf
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *           enum: [avatar, certification, banner]
 *           default: avatar
 *         description: Categoría del archivo (determina tipos permitidos y carpeta de destino)
 *     responses:
 *       200:
 *         description: URL prefirmada generada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                   description: URL prefirmada para subir el archivo (expira en 60s)
 *                   example: https://bucket.s3.amazonaws.com/...
 *                 finalUrl:
 *                   type: string
 *                   description: URL pública final del archivo en el CDN
 *                   example: https://cdn.example.com/avatars/1234567890-mi_avatar.jpg
 *                 fileName:
 *                   type: string
 *                   description: Nombre único del archivo en S3
 *                   example: avatars/1234567890-mi_avatar.jpg
 *       400:
 *         description: Parámetros inválidos o límite de plan excedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Faltan parámetros fileName y fileType son requeridos
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error al generar URL de subida
 */
router.get('/presigned-url', getPresignedUrl);

/**
 * @swagger
 * /api/v1/auth/upload/certification/{certificationId}:
 *   delete:
 *     summary: Elimina una certificación del perfil
 *     description: |
 *       Elimina una certificación del perfil del usuario autenticado.
 *       Esta acción:
 *       - Elimina el archivo de S3
 *       - Decrementa el contador de certificados en Space (libera cuota del plan)
 *       - Elimina la entrada del array de certificaciones en el perfil
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la certificación a eliminar
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Certificación eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Certificación eliminada correctamente
 *                 certifications:
 *                   type: array
 *                   description: Array actualizado de certificaciones del usuario
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       url:
 *                         type: string
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil o certificación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [Perfil no encontrado, Certificación no encontrada]
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error al eliminar la certificación
 */
router.delete('/certification/:certificationId', deleteCertification);

/**
 * Register upload routes
 * @param {Express} app - Express application
 */
export default function uploadRoutes(app) {
  app.use('/api/v1/auth/upload', router);
}
