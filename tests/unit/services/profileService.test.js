import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Use vi.hoisted to create mocks that will be available during hoisting
const { mockSave, mockFindOne, mockFindOneAndUpdate, mockFindOneAndDelete } =
  vi.hoisted(() => ({
    mockSave: vi.fn(),
    mockFindOne: vi.fn(),
    mockFindOneAndUpdate: vi.fn(),
    mockFindOneAndDelete: vi.fn(),
  }));

// Mock dependencies before importing the service
vi.mock('../../../src/models/Profile.js', () => {
  // Create a mock class for Profile that can be constructed
  const MockProfile = function (data) {
    Object.assign(this, data);
    this.save = mockSave;
  };
  MockProfile.findOne = mockFindOne;
  MockProfile.findOneAndUpdate = mockFindOneAndUpdate;
  MockProfile.findOneAndDelete = mockFindOneAndDelete;

  return { default: MockProfile };
});

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import * as profileService from '../../../src/services/profileService.js';

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue({});
  });

  describe('createProfile', () => {
    it('should create a profile successfully', async () => {
      const userId = new mongoose.Types.ObjectId();
      const userData = {
        userId,
        username: 'testuser',
        email: 'test@test.com',
      };

      const result = await profileService.createProfile(userData);

      // Verify save was called
      expect(mockSave).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        profileService.createProfile({
          username: 'testuser',
          email: 'test@test.com',
        })
      ).rejects.toThrow(
        'userId, username, and email are required to create a profile'
      );
    });

    it('should throw error if username is missing', async () => {
      await expect(
        profileService.createProfile({
          userId: new mongoose.Types.ObjectId(),
          email: 'test@test.com',
        })
      ).rejects.toThrow(
        'userId, username, and email are required to create a profile'
      );
    });

    it('should throw error if email is missing', async () => {
      await expect(
        profileService.createProfile({
          userId: new mongoose.Types.ObjectId(),
          username: 'testuser',
        })
      ).rejects.toThrow(
        'userId, username, and email are required to create a profile'
      );
    });
  });

  describe('getProfileByUserId', () => {
    it('should return profile for existing user', async () => {
      const mockProfile = {
        userId: 'user123',
        username: 'testuser',
        email: 'test@test.com',
        about_me: 'Test bio',
      };

      mockFindOne.mockResolvedValue(mockProfile);

      const result = await profileService.getProfileByUserId('user123');

      expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user123' });
      expect(result).toEqual(mockProfile);
    });

    it('should return null if profile not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await profileService.getProfileByUserId('nonexistent');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(
        profileService.getProfileByUserId('user123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getProfileByUsername', () => {
    it('should return profile by username', async () => {
      const mockProfile = {
        userId: 'user123',
        username: 'testuser',
        email: 'test@test.com',
      };

      mockFindOne.mockResolvedValue(mockProfile);

      const result = await profileService.getProfileByUsername('testuser');

      expect(mockFindOne).toHaveBeenCalledWith({ username: 'testuser' });
      expect(result).toEqual(mockProfile);
    });

    it('should return null if profile not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await profileService.getProfileByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const userId = 'user123';

    it('should update profile successfully', async () => {
      const updatedProfile = {
        userId,
        username: 'testuser',
        about_me: 'Updated bio',
        full_name: 'Test User',
      };

      mockFindOneAndUpdate.mockResolvedValue(updatedProfile);

      const result = await profileService.updateProfile(userId, {
        about_me: 'Updated bio',
        full_name: 'Test User',
      });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId },
        { $set: { about_me: 'Updated bio', full_name: 'Test User' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedProfile);
    });

    it('should remove restricted fields before update', async () => {
      const updatedProfile = {
        userId,
        username: 'testuser',
        about_me: 'Updated bio',
      };

      mockFindOneAndUpdate.mockResolvedValue(updatedProfile);

      await profileService.updateProfile(userId, {
        about_me: 'Updated bio',
        userId: 'should-be-removed',
        username: 'should-be-removed',
        email: 'should-be-removed@test.com',
      });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId },
        { $set: { about_me: 'Updated bio' } },
        { new: true, runValidators: true }
      );
    });

    it('should throw error if profile not found', async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);

      await expect(
        profileService.updateProfile(userId, { about_me: 'New bio' })
      ).rejects.toThrow(`Profile not found for user ${userId}`);
    });

    it('should update nested contact fields', async () => {
      const updateData = {
        contact: {
          phone: '123456789',
          city: 'Test City',
          social_media: {
            instagram: '@testuser',
          },
        },
      };

      mockFindOneAndUpdate.mockResolvedValue({
        userId,
        ...updateData,
      });

      await profileService.updateProfile(userId, updateData);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    });
  });

  describe('deleteProfile', () => {
    it('should delete profile successfully', async () => {
      const mockProfile = {
        userId: 'user123',
        username: 'testuser',
      };

      mockFindOneAndDelete.mockResolvedValue(mockProfile);

      const result = await profileService.deleteProfile('user123');

      expect(mockFindOneAndDelete).toHaveBeenCalledWith({ userId: 'user123' });
      expect(result).toEqual(mockProfile);
    });

    it('should throw error if profile not found', async () => {
      mockFindOneAndDelete.mockResolvedValue(null);

      await expect(profileService.deleteProfile('nonexistent')).rejects.toThrow(
        'Profile not found for user nonexistent'
      );
    });

    it('should propagate database errors', async () => {
      mockFindOneAndDelete.mockRejectedValue(new Error('Database error'));

      await expect(profileService.deleteProfile('user123')).rejects.toThrow(
        'Database error'
      );
    });
  });
});
