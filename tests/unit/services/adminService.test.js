import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Mock dependencies before importing the service
vi.mock('../../../src/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../../../src/services/profileService.js', () => ({
  deleteProfile: vi.fn(),
  getProfileByUserId: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/services/kafkaProducer.js', () => ({
  publishUserEvent: vi.fn().mockResolvedValue(undefined),
  isKafkaEnabled: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import * as adminService from '../../../src/services/adminService.js';
import User from '../../../src/models/User.js';
import * as profileService from '../../../src/services/profileService.js';

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users without passwords', async () => {
      const mockUsers = [
        { _id: 'id1', username: 'user1', email: 'user1@test.com' },
        { _id: 'id2', username: 'user2', email: 'user2@test.com' },
      ];

      User.find.mockResolvedValue(mockUsers);

      const result = await adminService.getAllUsers();

      expect(User.find).toHaveBeenCalledWith({}, '-password');
      expect(result).toEqual(mockUsers);
    });

    it('should throw error if database query fails', async () => {
      User.find.mockRejectedValue(new Error('Database error'));

      await expect(adminService.getAllUsers()).rejects.toThrow(
        'Database error'
      );
    });

    it('should return empty array when no users exist', async () => {
      User.find.mockResolvedValue([]);

      const result = await adminService.getAllUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getUserById', () => {
    const mockUserId = new mongoose.Types.ObjectId().toString();

    it('should return user by ID without password', async () => {
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@test.com',
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await adminService.getUserById(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId, '-password');
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(adminService.getUserById(mockUserId)).rejects.toThrow(
        'Usuario no encontrado'
      );
    });

    it('should propagate database errors', async () => {
      User.findById.mockRejectedValue(new Error('Database error'));

      await expect(adminService.getUserById(mockUserId)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username without password', async () => {
      const mockUser = {
        _id: 'id1',
        username: 'testuser',
        email: 'test@test.com',
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await adminService.getUserByUsername('testuser');

      expect(User.findOne).toHaveBeenCalledWith(
        { username: 'testuser' },
        '-password'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        adminService.getUserByUsername('nonexistent')
      ).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('updateUserByUsername', () => {
    const mockUser = {
      _id: 'id1',
      username: 'testuser',
      email: 'test@test.com',
      save: vi.fn(),
    };

    it('should update user with allowed fields', async () => {
      User.findOne
        .mockResolvedValueOnce(mockUser) // First call to find user
        .mockResolvedValueOnce({ ...mockUser, email: 'updated@test.com' }); // Second call after save
      mockUser.save.mockResolvedValue(mockUser);

      const result = await adminService.updateUserByUsername('testuser', {
        email: 'updated@test.com',
      });

      expect(User.findOne).toHaveBeenCalledWith({ username: 'testuser' });
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.email).toBe('updated@test.com');
    });

    it('should only update allowed fields (whitelist)', async () => {
      User.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      mockUser.save.mockResolvedValue(mockUser);

      await adminService.updateUserByUsername('testuser', {
        email: 'new@test.com',
        password: 'shouldNotUpdate', // Not in whitelist
        roles: ['admin'], // Not in whitelist
      });

      expect(mockUser.email).toBe('new@test.com');
      expect(mockUser.password).toBeUndefined();
      expect(mockUser.roles).toBeUndefined();
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        adminService.updateUserByUsername('nonexistent', {
          email: 'new@test.com',
        })
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('should propagate save errors', async () => {
      User.findOne.mockResolvedValue({
        ...mockUser,
        save: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      await expect(
        adminService.updateUserByUsername('testuser', { email: 'new@test.com' })
      ).rejects.toThrow('Save failed');
    });
  });

  describe('deleteUser', () => {
    const mockUserId = new mongoose.Types.ObjectId().toString();

    it('should delete user and associated profile', async () => {
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        role: 'beatmaker',
      };

      User.findById.mockResolvedValue(mockUser);
      profileService.getProfileByUserId.mockResolvedValue({
        userId: mockUserId,
      });
      profileService.deleteProfile.mockResolvedValue(null);
      User.findByIdAndDelete.mockResolvedValue(mockUser);

      const result = await adminService.deleteUser(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(profileService.deleteProfile).toHaveBeenCalledWith(mockUserId);
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(adminService.deleteUser(mockUserId)).rejects.toThrow(
        'Usuario no encontrado'
      );
    });

    it('should prevent deletion of last admin', async () => {
      const mockAdmin = {
        _id: mockUserId,
        username: 'admin',
        role: 'admin',
      };

      User.findById.mockResolvedValue(mockAdmin);
      User.countDocuments.mockResolvedValue(1);

      await expect(adminService.deleteUser(mockUserId)).rejects.toThrow(
        'No se puede eliminar el último administrador'
      );
    });

    it('should allow deletion of admin if other admins exist', async () => {
      const mockAdmin = {
        _id: mockUserId,
        username: 'admin',
        role: 'admin',
      };

      User.findById.mockResolvedValue(mockAdmin);
      User.countDocuments.mockResolvedValue(2);
      profileService.getProfileByUserId.mockResolvedValue({
        userId: mockUserId,
      });
      profileService.deleteProfile.mockResolvedValue(null);
      User.findByIdAndDelete.mockResolvedValue(mockAdmin);

      const result = await adminService.deleteUser(mockUserId);

      expect(result).toEqual(mockAdmin);
    });

    it('should continue user deletion even if profile deletion fails', async () => {
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        role: 'beatmaker',
      };

      User.findById.mockResolvedValue(mockUser);
      profileService.getProfileByUserId.mockResolvedValue({
        userId: mockUserId,
      });
      profileService.deleteProfile.mockRejectedValue(
        new Error('Profile error')
      );
      User.findByIdAndDelete.mockResolvedValue(mockUser);

      const result = await adminService.deleteUser(mockUserId);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockUser);
    });

    it('should handle case when user has no profile', async () => {
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        role: 'beatmaker',
      };

      User.findById.mockResolvedValue(mockUser);
      profileService.getProfileByUserId.mockResolvedValue(null);
      User.findByIdAndDelete.mockResolvedValue(mockUser);

      const result = await adminService.deleteUser(mockUserId);

      expect(profileService.deleteProfile).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });
});
