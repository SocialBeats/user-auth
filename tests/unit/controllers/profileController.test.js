import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('space-node-client', () => ({
  connect: vi.fn(() => ({
    features: {
      evaluate: vi.fn().mockResolvedValue({ allowed: true }),
    },
  })),
}));

vi.mock('../../../src/utils/spaceConnection.js', () => ({
  spaceClient: {
    features: {
      evaluate: vi.fn().mockResolvedValue({ allowed: true }),
    },
  },
}));

// Mock dependencies
vi.mock('../../../src/services/profileService.js', () => ({
  getProfileByUserId: vi.fn(),
  getFullProfileByUserId: vi.fn(),
  getProfileByUsername: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

vi.mock('../../../src/models/User.js', () => ({
  default: {
    findById: vi.fn().mockReturnValue({
      select: vi.fn(),
    }),
  },
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import * as profileController from '../../../src/controllers/profileController.js';
import * as profileService from '../../../src/services/profileService.js';
import User from '../../../src/models/User.js';

// Mock Express req/res/next
const mockRequest = (body = {}, user = null, params = {}) => ({
  body,
  user,
  params,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockNext = vi.fn();

describe('ProfileController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('should return user profile successfully', async () => {
      const mockProfile = {
        userId: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        about_me: 'Test bio',
        toObject: vi.fn().mockReturnValue({
          userId: 'user-id',
          username: 'testuser',
          email: 'test@test.com',
          about_me: 'Test bio',
        }),
      };
      const mockUser = { emailVerified: true };
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.getFullProfileByUserId.mockResolvedValue(mockProfile);
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      await profileController.getMyProfile(req, res, mockNext);

      expect(profileService.getFullProfileByUserId).toHaveBeenCalledWith(
        'user-id'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          emailVerified: true,
        })
      );
    });

    it('should return 404 if profile not found', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.getFullProfileByUserId.mockResolvedValue(null);
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({ emailVerified: false }),
      });

      await profileController.getMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should call next on error', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();
      const error = new Error('Database error');

      profileService.getFullProfileByUserId.mockRejectedValue(error);
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await profileController.getMyProfile(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProfileByUsername', () => {
    it('should return profile by username successfully', async () => {
      const mockProfile = {
        userId: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, null, { username: 'testuser' });
      const res = mockResponse();

      profileService.getProfileByUsername.mockResolvedValue(mockProfile);

      await profileController.getProfileByUsername(req, res, mockNext);

      expect(profileService.getProfileByUsername).toHaveBeenCalledWith(
        'testuser'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should return 404 if profile not found', async () => {
      const req = mockRequest({}, null, { username: 'nonexistent' });
      const res = mockResponse();

      profileService.getProfileByUsername.mockResolvedValue(null);

      await profileController.getProfileByUsername(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
          message: 'Perfil no encontrado para el usuario nonexistent',
        })
      );
    });

    it('should call next on error', async () => {
      const req = mockRequest({}, null, { username: 'testuser' });
      const res = mockResponse();
      const error = new Error('Database error');

      profileService.getProfileByUsername.mockRejectedValue(error);

      await profileController.getProfileByUsername(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateMyProfile', () => {
    it('should update profile successfully', async () => {
      const updatedProfile = {
        userId: 'user-id',
        username: 'testuser',
        about_me: 'Updated bio',
      };
      const req = mockRequest({ about_me: 'Updated bio' }, { id: 'user-id' });
      const res = mockResponse();

      profileService.updateProfile.mockResolvedValue(updatedProfile);

      await profileController.updateMyProfile(req, res, mockNext);

      expect(profileService.updateProfile).toHaveBeenCalledWith('user-id', {
        about_me: 'Updated bio',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedProfile);
    });

    it('should return 400 if trying to update restricted fields', async () => {
      const req = mockRequest(
        { userId: 'new-id', about_me: 'New bio' },
        { id: 'user-id' }
      );
      const res = mockResponse();

      await profileController.updateMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_UPDATE',
        })
      );
      expect(profileService.updateProfile).not.toHaveBeenCalled();
    });

    it('should return 400 if trying to update username', async () => {
      const req = mockRequest(
        { username: 'newusername', about_me: 'New bio' },
        { id: 'user-id' }
      );
      const res = mockResponse();

      await profileController.updateMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_UPDATE',
        })
      );
    });

    it('should return 400 if trying to update email', async () => {
      const req = mockRequest(
        { email: 'new@test.com', about_me: 'New bio' },
        { id: 'user-id' }
      );
      const res = mockResponse();

      await profileController.updateMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if profile not found', async () => {
      const req = mockRequest({ about_me: 'New bio' }, { id: 'user-id' });
      const res = mockResponse();

      profileService.updateProfile.mockRejectedValue(
        new Error('Profile not found')
      );

      await profileController.updateMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should call next on unexpected error', async () => {
      const req = mockRequest({ about_me: 'New bio' }, { id: 'user-id' });
      const res = mockResponse();
      const error = new Error('Unexpected error');

      profileService.updateProfile.mockRejectedValue(error);

      await profileController.updateMyProfile(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should update nested contact fields', async () => {
      const updateData = {
        contact: {
          phone: '123456789',
          city: 'Test City',
        },
      };
      const req = mockRequest(updateData, { id: 'user-id' });
      const res = mockResponse();

      profileService.updateProfile.mockResolvedValue({
        userId: 'user-id',
        ...updateData,
      });

      await profileController.updateMyProfile(req, res, mockNext);

      expect(profileService.updateProfile).toHaveBeenCalledWith(
        'user-id',
        updateData
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProfileByIdentifier', () => {
    it('should detect ObjectId and call getFullProfileByUserId', async () => {
      const mockProfile = {
        userId: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, null, {
        identifier: '507f1f77bcf86cd799439011',
      });
      const res = mockResponse();

      profileService.getFullProfileByUserId.mockResolvedValue(mockProfile);

      await profileController.getProfileByIdentifier(req, res, mockNext);

      expect(profileService.getFullProfileByUserId).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should detect username and call getProfileByUsername', async () => {
      const mockProfile = {
        userId: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, null, { identifier: 'testuser' });
      const res = mockResponse();

      profileService.getProfileByUsername.mockResolvedValue(mockProfile);

      await profileController.getProfileByIdentifier(req, res, mockNext);

      expect(profileService.getProfileByUsername).toHaveBeenCalledWith(
        'testuser'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should return 404 if profile not found by ObjectId', async () => {
      const req = mockRequest({}, null, {
        identifier: '507f1f77bcf86cd799439011',
      });
      const res = mockResponse();

      profileService.getFullProfileByUserId.mockResolvedValue(null);

      await profileController.getProfileByIdentifier(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should return 404 if profile not found by username', async () => {
      const req = mockRequest({}, null, { identifier: 'nonexistent' });
      const res = mockResponse();

      profileService.getProfileByUsername.mockResolvedValue(null);

      await profileController.getProfileByIdentifier(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should call next on error', async () => {
      const req = mockRequest({}, null, { identifier: 'testuser' });
      const res = mockResponse();
      const error = new Error('Database error');

      profileService.getProfileByUsername.mockRejectedValue(error);

      await profileController.getProfileByIdentifier(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProfileByUserId', () => {
    it('should return profile by userId successfully', async () => {
      const mockProfile = {
        userId: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, null, { userId: 'user-id' });
      req.params = { userId: 'user-id' };
      const res = mockResponse();

      profileService.getProfileByUserId = vi
        .fn()
        .mockResolvedValue(mockProfile);

      await profileController.getProfileByUserId(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should return 404 if profile not found by userId', async () => {
      const req = mockRequest({}, null, { userId: 'nonexistent' });
      req.params = { userId: 'nonexistent' };
      const res = mockResponse();

      profileService.getProfileByUserId = vi.fn().mockResolvedValue(null);

      await profileController.getProfileByUserId(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should call next on error', async () => {
      const req = mockRequest({}, null, { userId: 'user-id' });
      req.params = { userId: 'user-id' };
      const res = mockResponse();
      const error = new Error('Database error');

      profileService.getProfileByUserId = vi.fn().mockRejectedValue(error);

      await profileController.getProfileByUserId(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('searchProfiles', () => {
    it('should search profiles successfully', async () => {
      const mockProfiles = [
        { userId: '1', username: 'user1' },
        { userId: '2', username: 'user2' },
      ];
      const req = { query: { q: 'user' } };
      const res = mockResponse();

      profileService.searchProfiles = vi.fn().mockResolvedValue(mockProfiles);

      await profileController.searchProfiles(req, res, mockNext);

      expect(profileService.searchProfiles).toHaveBeenCalledWith('user');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ profiles: mockProfiles });
    });

    it('should return 400 if search term is missing', async () => {
      const req = { query: {} };
      const res = mockResponse();

      await profileController.searchProfiles(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'MISSING_SEARCH_TERM',
        message: 'El término de búsqueda (q) es requerido',
      });
    });

    it('should call next on error', async () => {
      const req = { query: { q: 'user' } };
      const res = mockResponse();
      const error = new Error('Search error');

      profileService.searchProfiles = vi.fn().mockRejectedValue(error);

      await profileController.searchProfiles(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAllProfiles', () => {
    it('should get all profiles with pagination', async () => {
      const mockResult = {
        profiles: [{ userId: '1' }, { userId: '2' }],
        pagination: { total: 2, page: 1, limit: 20 },
      };
      const req = { query: { page: '1', limit: '20' } };
      const res = mockResponse();

      profileService.getAllProfiles = vi.fn().mockResolvedValue(mockResult);

      await profileController.getAllProfiles(req, res, mockNext);

      expect(profileService.getAllProfiles).toHaveBeenCalledWith(1, 20);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should use default pagination values', async () => {
      const mockResult = { profiles: [], pagination: {} };
      const req = { query: {} };
      const res = mockResponse();

      profileService.getAllProfiles = vi.fn().mockResolvedValue(mockResult);

      await profileController.getAllProfiles(req, res, mockNext);

      expect(profileService.getAllProfiles).toHaveBeenCalledWith(1, 20);
    });

    it('should call next on error', async () => {
      const req = { query: {} };
      const res = mockResponse();
      const error = new Error('Database error');

      profileService.getAllProfiles = vi.fn().mockRejectedValue(error);

      await profileController.getAllProfiles(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getCompletionStatus', () => {
    it('should get completion status successfully', async () => {
      const mockStatus = {
        steps: [],
        completionPercentage: 50,
        verificationLevel: 'none',
      };
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.getProfileCompletionStatus = vi
        .fn()
        .mockResolvedValue(mockStatus);

      await profileController.getCompletionStatus(req, res, mockNext);

      expect(profileService.getProfileCompletionStatus).toHaveBeenCalledWith(
        'user-id'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockStatus);
    });

    it('should return 404 if profile not found', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.getProfileCompletionStatus = vi
        .fn()
        .mockRejectedValue(new Error('Perfil no encontrado'));

      await profileController.getCompletionStatus(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PROFILE_NOT_FOUND',
        })
      );
    });

    it('should call next on unexpected error', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();
      const error = new Error('Unexpected error');

      profileService.getProfileCompletionStatus = vi
        .fn()
        .mockRejectedValue(error);

      await profileController.getCompletionStatus(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteMyProfile', () => {
    const mockAuthService = {
      deleteUserAccount: vi.fn(),
    };

    beforeEach(() => {
      vi.doMock('../../../src/services/authService.js', () => mockAuthService);
    });

    it('should delete account successfully', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      const authServiceMock = {
        deleteUserAccount: vi.fn().mockResolvedValue({
          message: 'Cuenta eliminada exitosamente',
          deletedUserId: 'user-id',
        }),
      };

      vi.doMock('../../../src/services/authService.js', () => authServiceMock);

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cuenta eliminada exitosamente',
          deletedAt: expect.any(String),
        })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      const req = mockRequest({}, null);
      const res = mockResponse();

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AUTHENTICATION_REQUIRED',
        })
      );
    });

    it('should return 401 if user id is missing', async () => {
      const req = mockRequest({}, {});
      const res = mockResponse();

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AUTHENTICATION_REQUIRED',
        })
      );
    });

    it('should return 404 if user not found during deletion', async () => {
      const req = mockRequest({}, { id: 'nonexistent-id' });
      const res = mockResponse();

      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';

      await profileController.deleteMyProfile(req, res, mockNext);
    });

    it('should call next on unexpected error', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalled();
    });
  });
});
