import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, CDN_URL } from '../config/s3.js';

/**
 * Genera una URL prefirmada para subir archivos directamente a S3
 * @route GET /api/upload/presigned-url
 */
export const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.query;

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'Faltan parámetros: fileName y fileType son requeridos',
      });
    }

    // Validar tipo de archivo (solo imágenes)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        error:
          'Tipo de archivo no permitido. Solo se permiten imágenes (jpeg, png, gif, webp)',
      });
    }

    // Generar nombre único: timestamp + nombre sanitizado
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `avatars/${Date.now()}-${sanitizedName}`;

    // Crear comando PUT con ACL público
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
      ACL: 'public-read', // ¡Asegúrate de que esto esté presente!
    });

    // Generar URL prefirmada (expira en 60 segundos)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // URL final del CDN
    const finalUrl = `${CDN_URL}/${uniqueFileName}`;

    res.json({
      uploadUrl,
      finalUrl,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error('Error generando presigned URL:', error);
    res.status(500).json({
      error: 'Error al generar URL de subida',
    });
  }
};
