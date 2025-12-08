import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, CDN_URL } from '../config/s3.js';

// Tipos de archivo permitidos por categoría
const ALLOWED_TYPES = {
  avatar: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  certification: ['application/pdf'],
};

/**
 * Genera una URL prefirmada para subir archivos directamente a S3
 * @route GET /api/v1/auth/upload/presigned-url
 * @query fileName - Nombre del archivo
 * @query fileType - Tipo MIME del archivo
 * @query category - Categoría: 'avatar' o 'certification' (default: 'avatar')
 */
export const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType, category = 'avatar' } = req.query;

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'Missing parameters: fileName and fileType are required',
      });
    }

    // Validar categoría
    if (!ALLOWED_TYPES[category]) {
      return res.status(400).json({
        error: 'Categoría no válida. Use: avatar, certification',
      });
    }

    // Validar tipo de archivo según categoría
    const allowedTypes = ALLOWED_TYPES[category];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        error: `Tipo de archivo no permitido para ${category}. Permitidos: ${allowedTypes.join(', ')}`,
      });
    }

    // Generar nombre único según categoría
    const sanitizedName = fileName
      .replace(/\.\./g, '') // Remove path traversal attempts
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace disallowed chars
      .substring(0, 255); // Limit length
    const folder = category === 'certification' ? 'certifications' : 'avatars';
    const uniqueFileName = `${folder}/${Date.now()}-${sanitizedName}`;

    // Crear comando PUT con ACL público
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
      ACL: 'public-read',
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
