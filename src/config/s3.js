import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3 Client configurado para DigitalOcean Spaces
 * Compatible con AWS S3 API
 */
export const s3Client = new S3Client({
  endpoint: 'https://fra1.digitaloceanspaces.com',
  region: 'fra1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

export const BUCKET_NAME = 'user-s3-fis';
// Usar URL directa del bucket en lugar del CDN para evitar problemas de cache
export const CDN_URL = 'https://user-s3-fis.fra1.cdn.digitaloceanspaces.com';
