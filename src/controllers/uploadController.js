import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, CDN_URL } from '../config/s3.js';
import { spaceClient } from '../utils/spaceConnection.js';
import Profile from '../models/Profile.js';
import logger from '../../logger.js';

// Tipos de archivo permitidos por categoría
const ALLOWED_TYPES = {
  avatar: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  certification: ['application/pdf'],
  banner: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
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

    if (category === 'certification') {
      const evaluationResult = await spaceClient.features.evaluate(
        req.user.id,
        'socialbeats-certificates',
        { 'socialbeats-maxCertificates': 1 }
      );

      const token = await spaceClient.features.generateUserPricingToken(
        req.user.id
      );
      console.log(token);

      if (evaluationResult.eval) {
        return res.status(400).json({
          error:
            'Has excedido tu límite de certificados para tu plan. Prueba a hacer upgrade a un plan superior.',
        });
      }
    }

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'Missing parameters: fileName and fileType are required',
      });
    }

    // Validar categoría
    if (!ALLOWED_TYPES[category]) {
      return res.status(400).json({
        error: 'Categoría no válida. Use: avatar, certification, banner',
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
    const folderMap = {
      avatar: 'avatars',
      certification: 'certifications',
      banner: 'banners',
    };
    const folder = folderMap[category];
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

/**
 * Elimina una certificación del perfil del usuario
 * - Borra el archivo de S3
 * - Decrementa el contador en Space para liberar cuota
 * - Elimina la entrada del array de certificaciones
 * @route DELETE /api/v1/auth/upload/certification/:certificationId
 */
export const deleteCertification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { certificationId } = req.params;

    // Obtener el perfil del usuario
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Buscar la certificación por ID
    const certification = profile.certifications.find(
      (cert) => cert._id.toString() === certificationId
    );

    if (!certification) {
      return res.status(404).json({ error: 'Certificación no encontrada' });
    }

    // Extraer la key de S3 desde la URL del CDN
    // URL formato: https://user-s3-fis.fra1.digitaloceanspaces.com/certifications/1234567890-filename.pdf
    const certUrl = certification.url;
    let s3Key = null;

    if (certUrl && certUrl.includes(CDN_URL)) {
      s3Key = certUrl.replace(`${CDN_URL}/`, '');
    }

    // Borrar archivo de S3 si tenemos la key
    if (s3Key) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        });
        await s3Client.send(deleteCommand);
        logger.info(`Archivo S3 eliminado: ${s3Key}`);
      } catch (s3Error) {
        // Log pero no fallar - el archivo puede no existir
        logger.warn(
          `No se pudo eliminar archivo de S3: ${s3Key}`,
          s3Error.message
        );
      }
    }

    // Decrementar contador en Space para liberar cuota (usando SDK)
    try {
      const result = await spaceClient.features.evaluate(
        userId,
        'socialbeats-certificates',
        { 'socialbeats-maxCertificates': -1 }
      );
      logger.info(`Space evaluate result for user ${userId}:`, result);
    } catch (spaceError) {
      // Log pero no fallar - no es crítico
      logger.warn(
        `No se pudo decrementar contador en Space: ${spaceError.message}`
      );
    }

    // Eliminar la certificación del array
    profile.certifications = profile.certifications.filter(
      (cert) => cert._id.toString() !== certificationId
    );
    await profile.save();

    logger.info(
      `Certificación ${certificationId} eliminada para usuario ${userId}`
    );

    res.json({
      message: 'Certificación eliminada correctamente',
      certifications: profile.certifications,
    });
  } catch (error) {
    logger.error('Error eliminando certificación:', error);
    res.status(500).json({
      error: 'Error al eliminar la certificación',
    });
  }
};
