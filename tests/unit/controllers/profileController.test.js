import { describe, it, expect, vi, beforeEach } from 'vitest';

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
          message: 'Profile not found for user nonexistent',
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

  describe('deleteMyProfile', () => {
    it('should delete profile successfully', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.deleteProfile.mockResolvedValue({ userId: 'user-id' });

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(profileService.deleteProfile).toHaveBeenCalledWith('user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile deleted successfully',
      });
    });

    it('should return 404 if profile not found', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      profileService.deleteProfile.mockRejectedValue(
        new Error('Profile not found')
      );

      await profileController.deleteMyProfile(req, res, mockNext);

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

      profileService.deleteProfile.mockRejectedValue(error);

      await profileController.deleteMyProfile(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
