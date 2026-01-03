import { Router } from 'express';
import {
  getPresignedUrl,
  deleteCertification,
} from '../controllers/uploadController.js';

const router = Router();

/**
 * @route GET /presigned-url
 * @desc Get presigned URL to upload file to S3
 * @access Private (requires authentication - already validated by global verifyToken)
 * @query fileName - File name
 * @query fileType - File MIME type
 */
router.get('/presigned-url', getPresignedUrl);

/**
 * @route DELETE /certification/:certificationId
 * @desc Delete a certification from S3 and profile
 * @access Private (requires authentication)
 * @param certificationId - The MongoDB _id of the certification to delete
 */
router.delete('/certification/:certificationId', deleteCertification);

/**
 * Register upload routes
 * @param {Express} app - Express application
 */
export default function uploadRoutes(app) {
  app.use('/api/v1/auth/upload', router);
}
