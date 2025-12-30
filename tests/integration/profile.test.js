import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  api,
  createTestUser,
  cleanupDatabase,
  cleanupRedis,
  loginTestUser,
} from '../setup/setup.js';
import Profile from '../../src/models/Profile.js';

describe('Profile API Integration Tests', () => {
  let testUser;
  let accessToken;

  beforeEach(async () => {
    await cleanupDatabase();
    await cleanupRedis();

    // Create a test user with profile
    const result = await createTestUser({
      username: 'profileuser',
      email: 'profile@test.com',
      password: 'password123',
    });
    testUser = result.user;

    // Login to get token
    const tokens = await loginTestUser('profileuser', 'password123');
    accessToken = tokens.accessToken;
  });

  describe('GET /api/v1/profile/me', () => {
    it('should get own profile successfully', async () => {
      const res = await api
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('profileuser');
      expect(res.body.email).toBe('profile@test.com');
    });

    it('should reject without authentication', async () => {
      const res = await api.get('/api/v1/profile/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await api
        .get('/api/v1/profile/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/profile/:username', () => {
    beforeEach(async () => {
      // Create another user whose profile we'll fetch
      await createTestUser({
        username: 'anotheruser',
        email: 'another@test.com',
        password: 'password123',
      });
    });

    it('should get profile by username (authenticated)', async () => {
      const res = await api
        .get('/api/v1/profile/anotheruser')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('anotheruser');
    });

    it('should return 404 for non-existent username', async () => {
      const res = await api
        .get('/api/v1/profile/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/profile/me', () => {
    it('should update profile successfully', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          about_me: 'Updated bio',
          full_name: 'Test User',
        });

      expect(res.status).toBe(200);
      expect(res.body.about_me).toBe('Updated bio');
      expect(res.body.full_name).toBe('Test User');
    });

    it('should update contact info', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          contact: {
            phone: '123456789',
            city: 'Test City',
            country: 'Test Country',
            social_media: {
              instagram: '@testuser',
              twitter: '@testuser',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.contact.phone).toBe('123456789');
      expect(res.body.contact.city).toBe('Test City');
    });

    it('should update tags', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tags: ['hip-hop', 'producer', 'beatmaker'],
        });

      expect(res.status).toBe(200);
      expect(res.body.tags).toContain('hip-hop');
      expect(res.body.tags).toContain('producer');
    });

    it('should reject updating restricted fields (userId)', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: 'new-user-id',
          about_me: 'New bio',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_UPDATE');
    });

    it('should reject updating restricted fields (username)', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          username: 'newusername',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_UPDATE');
    });

    it('should reject updating restricted fields (email)', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'newemail@test.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_UPDATE');
    });

    it('should reject without authentication', async () => {
      const res = await api.put('/api/v1/profile/me').send({
        about_me: 'New bio',
      });

      expect(res.status).toBe(401);
    });

    it('should update certifications', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          certifications: [
            {
              title: 'Music Production Certificate',
              url: 'https://example.com/cert.pdf',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.certifications).toHaveLength(1);
      expect(res.body.certifications[0].title).toBe(
        'Music Production Certificate'
      );
    });

    it('should update avatar URL', async () => {
      const res = await api
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          avatar: 'https://cdn.example.com/avatar.jpg',
        });

      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe('https://cdn.example.com/avatar.jpg');
    });
  });

  describe('DELETE /api/v1/profile/me', () => {
    it('should delete account and profile successfully', async () => {
      const res = await api
        .delete('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Account deleted successfully');
      expect(res.body.deletedAt).toBeDefined();

      // Verify profile was deleted
      const profile = await Profile.findOne({ userId: testUser._id });
      expect(profile).toBeNull();
    });

    it('should invalidate credentials after account deletion', async () => {
      await api
        .delete('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      const loginRes = await api.post('/api/v1/auth/login').send({
        identifier: 'profileuser',
        password: 'password123',
      });

      expect(loginRes.status).toBe(401);
    });

    it('should reject without authentication', async () => {
      const res = await api.delete('/api/v1/profile/me');

      expect(res.status).toBe(401);
    });

    it('should return 404 if account already deleted', async () => {
      await api
        .delete('/api/v1/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      const User = (await import('../../src/models/User.js')).default;
      const deletedUser = await User.findById(testUser._id);
      expect(deletedUser).toBeNull();
    });
  });
});
