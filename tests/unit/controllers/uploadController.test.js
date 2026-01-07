import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('space-node-client', () => ({
  connect: vi.fn(() => ({
    features: {
      evaluate: vi.fn().mockResolvedValue({ eval: true }),
      generateUserPricingToken: vi.fn().mockResolvedValue('test-pricing-token'),
    },
  })),
}));

vi.mock('../../../src/utils/spaceConnection.js', () => ({
  spaceClient: {
    features: {
      evaluate: vi.fn().mockResolvedValue({ eval: true }),
      generateUserPricingToken: vi.fn().mockResolvedValue('test-pricing-token'),
    },
  },
}));

vi.mock('axios', () => ({
  default: {
    put: vi.fn().mockResolvedValue({}),
  },
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn().mockImplementation((params) => params),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('../../../src/config/s3.js', () => ({
  s3Client: {},
  BUCKET_NAME: 'test-bucket',
  CDN_URL: 'https://cdn.example.com',
}));

// Import after mocks
import { getPresignedUrl } from '../../../src/controllers/uploadController.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock Express req/res
const mockRequest = (query = {}, user = { id: 'test-user-id' }) => ({
  query,
  user,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('UploadController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPresignedUrl', () => {
    it('should generate presigned URL for avatar successfully', async () => {
      const mockUploadUrl = 'https://s3.example.com/presigned-url';
      getSignedUrl.mockResolvedValue(mockUploadUrl);

      const req = mockRequest({
        fileName: 'avatar.jpg',
        fileType: 'image/jpeg',
        category: 'avatar',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadUrl: mockUploadUrl,
          finalUrl: expect.stringContaining('cdn.example.com'),
          fileName: expect.stringContaining('avatars/'),
        })
      );
    });

    it('should use avatar as default category', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'image.jpg',
        fileType: 'image/jpeg',
        // No category specified
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining('avatars/'),
        })
      );
    });

    it('should generate presigned URL for certification', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'cert.pdf',
        fileType: 'application/pdf',
        category: 'certification',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining('certifications/'),
        })
      );
    });

    it('should return 400 if fileName is missing', async () => {
      const req = mockRequest({
        fileType: 'image/jpeg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Faltan parámetros: fileName y fileType son requeridos',
      });
    });

    it('should return 400 if fileType is missing', async () => {
      const req = mockRequest({
        fileName: 'test.jpg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid category', async () => {
      const req = mockRequest({
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
        category: 'invalid',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Categoría no válida. Use: avatar, certification, banner',
      });
    });

    it('should return 400 for invalid file type for avatar', async () => {
      const req = mockRequest({
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        category: 'avatar',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Tipo de archivo no permitido'),
        })
      );
    });

    it('should return 400 for invalid file type for certification', async () => {
      const req = mockRequest({
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
        category: 'certification',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Tipo de archivo no permitido'),
        })
      );
    });

    it('should sanitize fileName by removing path traversal', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: '../../secret/file.jpg',
        fileType: 'image/jpeg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.not.stringContaining('..'),
        })
      );
    });

    it('should sanitize fileName by removing leading dots', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: '...hidden.jpg',
        fileType: 'image/jpeg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.fileName).not.toMatch(/^\./);
    });

    it('should replace disallowed characters in fileName', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'file with spaces!@#.jpg',
        fileType: 'image/jpeg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.fileName).not.toContain(' ');
      expect(jsonCall.fileName).not.toContain('!');
      expect(jsonCall.fileName).not.toContain('@');
    });

    it('should return 500 on S3 error', async () => {
      getSignedUrl.mockRejectedValue(new Error('S3 error'));

      const req = mockRequest({
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error al generar URL de subida',
      });
    });

    it('should accept image/webp for avatar', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'avatar.webp',
        fileType: 'image/webp',
        category: 'avatar',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadUrl: expect.any(String),
        })
      );
    });

    it('should accept image/gif for avatar', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'avatar.gif',
        fileType: 'image/gif',
        category: 'avatar',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadUrl: expect.any(String),
        })
      );
    });

    it('should accept image/png for avatar', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'avatar.png',
        fileType: 'image/png',
        category: 'avatar',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadUrl: expect.any(String),
        })
      );
    });

    it('should generate presigned URL for banner', async () => {
      getSignedUrl.mockResolvedValue('https://s3.example.com/url');

      const req = mockRequest({
        fileName: 'banner.jpg',
        fileType: 'image/jpeg',
        category: 'banner',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining('banners/'),
        })
      );
    });

    it('should return 400 if certificate limit exceeded', async () => {
      // Mock Space to return eval: false
      const { spaceClient } = await import(
        '../../../src/utils/spaceConnection.js'
      );
      spaceClient.features.evaluate.mockResolvedValueOnce({ eval: false });

      const req = mockRequest({
        fileName: 'cert.pdf',
        fileType: 'application/pdf',
        category: 'certification',
      });
      const res = mockResponse();

      await getPresignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('excedido'),
        })
      );
    });
  });

  describe('deleteCertification', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // Mock Profile model
    vi.mock('../../../src/models/Profile.js', () => ({
      default: {
        findOne: vi.fn(),
      },
    }));

    // Mock S3
    vi.mock('@aws-sdk/client-s3', () => ({
      PutObjectCommand: vi.fn(),
      DeleteObjectCommand: vi.fn().mockImplementation((params) => params),
    }));

    vi.mock('../../../src/config/s3.js', () => ({
      s3Client: {
        send: vi.fn().mockResolvedValue({}),
      },
      BUCKET_NAME: 'test-bucket',
      CDN_URL: 'https://cdn.example.com',
    }));

    vi.mock('../../../logger.js', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    }));

    it('should delete certification successfully', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;
      const { s3Client } = await import('../../../src/config/s3.js');

      const mockProfile = {
        userId: 'user-id',
        certifications: [
          {
            _id: { toString: () => 'cert-id-1' },
            url: 'https://cdn.example.com/certifications/test.pdf',
            name: 'Test Cert',
          },
          {
            _id: { toString: () => 'cert-id-2' },
            url: 'https://cdn.example.com/certifications/test2.pdf',
            name: 'Test Cert 2',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      Profile.findOne.mockResolvedValue(mockProfile);
      s3Client.send.mockResolvedValue({});

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'cert-id-1' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      expect(Profile.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(mockProfile.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Certificación eliminada correctamente',
        })
      );
    });

    it('should return 404 if profile not found', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;

      Profile.findOne.mockResolvedValue(null);

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'cert-id-1' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Perfil no encontrado' });
    });

    it('should return 404 if certification not found', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;

      const mockProfile = {
        userId: 'user-id',
        certifications: [
          {
            _id: { toString: () => 'cert-id-other' },
            url: 'https://cdn.example.com/certifications/test.pdf',
          },
        ],
        save: vi.fn(),
      };

      Profile.findOne.mockResolvedValue(mockProfile);

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'nonexistent-cert' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Certificación no encontrada',
      });
    });

    it('should handle S3 deletion error gracefully', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;
      const { s3Client } = await import('../../../src/config/s3.js');

      const mockProfile = {
        userId: 'user-id',
        certifications: [
          {
            _id: { toString: () => 'cert-id-1' },
            url: 'https://cdn.example.com/certifications/test.pdf',
            name: 'Test Cert',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      Profile.findOne.mockResolvedValue(mockProfile);
      s3Client.send.mockRejectedValue(new Error('S3 error'));

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'cert-id-1' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      // Should still succeed even if S3 fails
      expect(mockProfile.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Certificación eliminada correctamente',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;

      Profile.findOne.mockRejectedValue(new Error('Database error'));

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'cert-id-1' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error al eliminar la certificación',
      });
    });

    it('should handle certification URL without CDN prefix', async () => {
      const { deleteCertification } = await import(
        '../../../src/controllers/uploadController.js'
      );
      const Profile = (await import('../../../src/models/Profile.js')).default;
      const { s3Client } = await import('../../../src/config/s3.js');

      const mockProfile = {
        userId: 'user-id',
        certifications: [
          {
            _id: { toString: () => 'cert-id-1' },
            url: 'https://other-cdn.com/file.pdf', // Different CDN
            name: 'Test Cert',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      Profile.findOne.mockResolvedValue(mockProfile);

      const req = {
        user: { id: 'user-id' },
        params: { certificationId: 'cert-id-1' },
      };
      const res = mockResponse();

      await deleteCertification(req, res);

      // Should NOT attempt S3 deletion for non-matching CDN
      expect(s3Client.send).not.toHaveBeenCalled();
      expect(mockProfile.save).toHaveBeenCalled();
    });
  });
});
