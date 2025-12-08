import { Router } from 'express';
import { getPresignedUrl } from '../controllers/uploadController.js';

const router = Router();

/**
 * @route GET /presigned-url
 * @desc Obtener URL prefirmada para subir archivo a S3
 * @access Private (requiere autenticación - ya validado por verifyToken global)
 * @query fileName - Nombre del archivo
 * @query fileType - Tipo MIME del archivo
 */
router.get('/presigned-url', getPresignedUrl);

/**
 * Register upload routes
 * @param {Express} app - Express application
 */
export default function uploadRoutes(app) {
  app.use('/api/v1/auth/upload', router);
}
