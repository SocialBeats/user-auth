import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/services/authService.js', () => ({
  registerUser: vi.fn(),
}));

vi.mock('../../../src/services/adminService.js', () => ({
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  getUserByUsername: vi.fn(),
  updateUserByUsername: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import * as adminController from '../../../src/controllers/adminController.js';
import * as authService from '../../../src/services/authService.js';
import * as adminService from '../../../src/services/adminService.js';

// Mock Express req/res
const mockRequest = (body = {}, params = {}) => ({
  body,
  params,
});

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('AdminController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAdmin', () => {
    it('should create admin successfully', async () => {
      const req = mockRequest({
        username: 'newadmin',
        email: 'admin@test.com',
        password: 'adminpass123',
      });
      const res = mockResponse();

      authService.registerUser.mockResolvedValue({
        _id: 'admin-id',
        username: 'newadmin',
      });

      await adminController.createAdmin(req, res);

      expect(authService.registerUser).toHaveBeenCalledWith({
        username: 'newadmin',
        email: 'admin@test.com',
        password: 'adminpass123',
        roles: ['admin'],
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Admin created successfully',
      });
    });

    it('should return 400 if username is missing', async () => {
      const req = mockRequest({
        email: 'admin@test.com',
        password: 'adminpass123',
      });
      const res = mockResponse();

      await adminController.createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if email is missing', async () => {
      const req = mockRequest({
        username: 'newadmin',
        password: 'adminpass123',
      });
      const res = mockResponse();

      await adminController.createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_FIELDS',
        })
      );
    });

    it('should return 400 if password is missing', async () => {
      const req = mockRequest({
        username: 'newadmin',
        email: 'admin@test.com',
      });
      const res = mockResponse();

      await adminController.createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 if username or email already exists', async () => {
      const req = mockRequest({
        username: 'existingadmin',
        email: 'admin@test.com',
        password: 'adminpass123',
      });
      const res = mockResponse();

      authService.registerUser.mockRejectedValue(
        new Error('Username already exists')
      );

      await adminController.createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DUPLICATE_ENTRY',
        })
      );
    });

    it('should return 500 on unexpected error', async () => {
      const req = mockRequest({
        username: 'newadmin',
        email: 'admin@test.com',
        password: 'adminpass123',
      });
      const res = mockResponse();

      authService.registerUser.mockRejectedValue(new Error('Database error'));

      await adminController.createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CREATION_FAILED',
        })
      );
    });
  });

  describe('listUsers', () => {
    it('should list all users successfully', async () => {
      const mockUsers = [
        { _id: '1', username: 'user1', email: 'user1@test.com' },
        { _id: '2', username: 'user2', email: 'user2@test.com' },
      ];
      const req = mockRequest();
      const res = mockResponse();

      adminService.getAllUsers.mockResolvedValue(mockUsers);

      await adminController.listUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    it('should return empty array if no users', async () => {
      const req = mockRequest();
      const res = mockResponse();

      adminService.getAllUsers.mockResolvedValue([]);

      await adminController.listUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 on error', async () => {
      const req = mockRequest();
      const res = mockResponse();

      adminService.getAllUsers.mockRejectedValue(new Error('Database error'));

      await adminController.listUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FETCH_FAILED',
        })
      );
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      adminService.getUserById.mockResolvedValue(mockUser);

      await adminController.getUserById(req, res);

      expect(adminService.getUserById).toHaveBeenCalledWith('user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 if user not found', async () => {
      const req = mockRequest({}, { id: 'nonexistent-id' });
      const res = mockResponse();

      adminService.getUserById.mockRejectedValue(new Error('User not found'));

      await adminController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 500 on database error', async () => {
      const req = mockRequest({}, { id: 'some-id' });
      const res = mockResponse();

      adminService.getUserById.mockRejectedValue(new Error('Database error'));

      await adminController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FETCH_FAILED',
        })
      );
    });
  });

  describe('getUserByUsername', () => {
    it('should get user by username successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
      };
      const req = mockRequest({}, { username: 'testuser' });
      const res = mockResponse();

      adminService.getUserByUsername.mockResolvedValue(mockUser);

      await adminController.getUserByUsername(req, res);

      expect(adminService.getUserByUsername).toHaveBeenCalledWith('testuser');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 if user not found', async () => {
      const req = mockRequest({}, { username: 'nonexistent' });
      const res = mockResponse();

      adminService.getUserByUsername.mockRejectedValue(
        new Error('User not found')
      );

      await adminController.getUserByUsername(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 500 on database error', async () => {
      const req = mockRequest({}, { username: 'testuser' });
      const res = mockResponse();

      adminService.getUserByUsername.mockRejectedValue(
        new Error('Database error')
      );

      await adminController.getUserByUsername(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUpdatedUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'updated@test.com',
      };
      const req = mockRequest(
        { email: 'updated@test.com' },
        { username: 'testuser' }
      );
      const res = mockResponse();

      adminService.updateUserByUsername.mockResolvedValue(mockUpdatedUser);

      await adminController.updateUser(req, res);

      expect(adminService.updateUserByUsername).toHaveBeenCalledWith(
        'testuser',
        {
          email: 'updated@test.com',
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User updated successfully',
        user: mockUpdatedUser,
      });
    });

    it('should return 404 if user not found', async () => {
      const req = mockRequest(
        { email: 'new@test.com' },
        { username: 'nonexistent' }
      );
      const res = mockResponse();

      adminService.updateUserByUsername.mockRejectedValue(
        new Error('User not found')
      );

      await adminController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 500 on update error', async () => {
      const req = mockRequest(
        { email: 'new@test.com' },
        { username: 'testuser' }
      );
      const res = mockResponse();

      adminService.updateUserByUsername.mockRejectedValue(
        new Error('Update failed')
      );

      await adminController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UPDATE_FAILED',
        })
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      adminService.deleteUser.mockResolvedValue({ _id: 'user-id' });

      await adminController.deleteUser(req, res);

      expect(adminService.deleteUser).toHaveBeenCalledWith('user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deleted successfully',
      });
    });

    it('should return 404 if user not found', async () => {
      const req = mockRequest({}, { id: 'nonexistent-id' });
      const res = mockResponse();

      adminService.deleteUser.mockRejectedValue(new Error('User not found'));

      await adminController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return 500 on delete error', async () => {
      const req = mockRequest({}, { id: 'user-id' });
      const res = mockResponse();

      adminService.deleteUser.mockRejectedValue(new Error('Delete failed'));

      await adminController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DELETE_FAILED',
        })
      );
    });
  });
});
