import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockRequest = (query = {}) => ({
  query,
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
        error: 'Missing parameters: fileName and fileType are required',
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
        error: 'Categoría no válida. Use: avatar, certification',
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
  });
});
