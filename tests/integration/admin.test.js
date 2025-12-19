import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  api,
  createTestUser,
  createTestAdmin,
  cleanupDatabase,
  cleanupRedis,
  loginTestUser,
} from '../setup/setup.js';
import User from '../../src/models/User.js';
import Profile from '../../src/models/Profile.js';

describe('Admin API Integration Tests', () => {
  let adminUser;
  let adminToken;

  beforeEach(async () => {
    await cleanupDatabase();
    await cleanupRedis();

    // Create an admin user
    const result = await createTestAdmin({
      username: 'testadmin',
      email: 'admin@test.com',
      password: 'adminPass123',
    });
    adminUser = result.user;

    // Login as admin
    const tokens = await loginTestUser('testadmin', 'adminPass123');
    adminToken = tokens.accessToken;
  });

  describe('POST /api/v1/admin/create-admin', () => {
    it('should create a new admin successfully', async () => {
      const res = await api
        .post('/api/v1/admin/create-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newadmin',
          email: 'newadmin@test.com',
          password: 'newadminPass123',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Admin created successfully');

      // Verify admin was created
      const admin = await User.findOne({ username: 'newadmin' });
      expect(admin).toBeDefined();
      expect(admin.roles).toContain('admin');
    });

    it('should reject without admin authentication', async () => {
      // Create a regular user
      await createTestUser({
        username: 'regularuser',
        email: 'regular@test.com',
        password: 'password123',
      });
      const { accessToken } = await loginTestUser('regularuser', 'password123');

      const res = await api
        .post('/api/v1/admin/create-admin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          username: 'newadmin',
          email: 'newadmin@test.com',
          password: 'adminPass123',
        });

      expect(res.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const res = await api.post('/api/v1/admin/create-admin').send({
        username: 'newadmin',
        email: 'newadmin@test.com',
        password: 'adminPass123',
      });

      expect(res.status).toBe(401);
    });

    it('should reject with missing fields', async () => {
      const res = await api
        .post('/api/v1/admin/create-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newadmin',
          // missing email and password
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject duplicate username', async () => {
      const res = await api
        .post('/api/v1/admin/create-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testadmin', // Already exists
          email: 'another@test.com',
          password: 'adminPass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('DUPLICATE_ENTRY');
    });
  });

  describe('GET /api/v1/admin/users', () => {
    beforeEach(async () => {
      // Create some test users
      await createTestUser({
        username: 'user1',
        email: 'user1@test.com',
        password: 'password123',
      });
      await createTestUser({
        username: 'user2',
        email: 'user2@test.com',
        password: 'password123',
      });
    });

    it('should list all users', async () => {
      const res = await api
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3); // admin + 2 users
    });

    it('should exclude passwords from response', async () => {
      const res = await api
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.forEach((user) => {
        expect(user.password).toBeUndefined();
      });
    });

    it('should reject without admin role', async () => {
      const { accessToken } = await loginTestUser('user1', 'password123');

      const res = await api
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/users/:id', () => {
    let testUser;

    beforeEach(async () => {
      const result = await createTestUser({
        username: 'targetuser',
        email: 'target@test.com',
        password: 'password123',
      });
      testUser = result.user;
    });

    it('should get user by ID', async () => {
      const res = await api
        .get(`/api/v1/admin/users/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('targetuser');
      expect(res.body.email).toBe('target@test.com');
      expect(res.body.password).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format but not existing

      const res = await api
        .get(`/api/v1/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /api/v1/admin/users/username/:username', () => {
    beforeEach(async () => {
      await createTestUser({
        username: 'findme',
        email: 'findme@test.com',
        password: 'password123',
      });
    });

    it('should get user by username', async () => {
      const res = await api
        .get('/api/v1/admin/users/username/findme')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('findme');
      expect(res.body.email).toBe('findme@test.com');
    });

    it('should return 404 for non-existent username', async () => {
      const res = await api
        .get('/api/v1/admin/users/username/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/admin/users/:username', () => {
    beforeEach(async () => {
      await createTestUser({
        username: 'updateme',
        email: 'updateme@test.com',
        password: 'password123',
      });
    });

    it('should update user successfully', async () => {
      const res = await api
        .put('/api/v1/admin/users/updateme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'updated@test.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User updated successfully');
      expect(res.body.user.email).toBe('updated@test.com');
    });

    it('should update username', async () => {
      const res = await api
        .put('/api/v1/admin/users/updateme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newusername',
        });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await api
        .put('/api/v1/admin/users/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@test.com',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/admin/users/:id', () => {
    let userToDelete;

    beforeEach(async () => {
      const result = await createTestUser({
        username: 'deleteme',
        email: 'deleteme@test.com',
        password: 'password123',
      });
      userToDelete = result.user;
    });

    it('should delete user successfully', async () => {
      const res = await api
        .delete(`/api/v1/admin/users/${userToDelete._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User deleted successfully');

      // Verify user was deleted
      const user = await User.findById(userToDelete._id);
      expect(user).toBeNull();

      // Verify profile was also deleted
      const profile = await Profile.findOne({ userId: userToDelete._id });
      expect(profile).toBeNull();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await api
        .delete(`/api/v1/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject without admin role', async () => {
      const { accessToken } = await loginTestUser('deleteme', 'password123');

      const res = await api
        .delete(`/api/v1/admin/users/${userToDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
