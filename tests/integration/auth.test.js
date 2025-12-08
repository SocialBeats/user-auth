import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import {
  api,
  createTestUser,
  cleanupDatabase,
  cleanupRedis,
} from '../setup/setup.js';
import User from '../../src/models/User.js';
import Profile from '../../src/models/Profile.js';

describe('Auth API Integration Tests', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await cleanupRedis();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');

      // Verify user was created in database
      const user = await User.findOne({ username: 'newuser' });
      expect(user).toBeDefined();
      expect(user.email).toBe('newuser@test.com');
      expect(user.roles).toContain('beatmaker');

      // Verify profile was created
      const profile = await Profile.findOne({ username: 'newuser' });
      expect(profile).toBeDefined();
    });

    it('should reject registration with missing username', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject registration with missing email', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject registration with missing password', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        email: 'test@test.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject registration with invalid email format', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_EMAIL');
    });

    it('should reject registration with short username', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'ab',
        email: 'test@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_USERNAME');
    });

    it('should reject registration with short password', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        email: 'test@test.com',
        password: '12345',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_PASSWORD');
    });

    it('should reject duplicate username', async () => {
      // Create a user first
      await createTestUser({
        username: 'existinguser',
        email: 'existing@test.com',
      });

      const res = await api.post('/api/v1/auth/register').send({
        username: 'existinguser',
        email: 'new@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('USERNAME_EXISTS');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ username: 'user1', email: 'duplicate@test.com' });

      const res = await api.post('/api/v1/auth/register').send({
        username: 'newuser',
        email: 'duplicate@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_EXISTS');
    });

    it('should trim username and lowercase email', async () => {
      const res = await api.post('/api/v1/auth/register').send({
        username: '  trimmeduser  ',
        email: '  TEST@TEST.COM  ',
        password: 'password123',
      });

      expect(res.status).toBe(201);

      const user = await User.findOne({ username: 'trimmeduser' });
      expect(user).toBeDefined();
      expect(user.email).toBe('test@test.com');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;
    const testPassword = 'testPassword123';

    beforeEach(async () => {
      const result = await createTestUser({
        username: 'loginuser',
        email: 'login@test.com',
        password: testPassword,
      });
      testUser = result.user;
    });

    it('should login successfully with username', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: 'loginuser',
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should login successfully with email', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: 'login@test.com',
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: 'loginuser',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent user', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: 'nonexistent',
        password: 'password123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing identifier', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject login with missing password', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: 'loginuser',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_FIELDS');
    });

    it('should reject login with empty identifier', async () => {
      const res = await api.post('/api/v1/auth/login').send({
        identifier: '   ',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EMPTY_FIELDS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      await createTestUser({
        username: 'refreshuser',
        email: 'refresh@test.com',
        password: 'password123',
      });

      const loginRes = await api.post('/api/v1/auth/login').send({
        identifier: 'refreshuser',
        password: 'password123',
      });

      refreshToken = loginRes.body.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const res = await api.post('/api/v1/auth/refresh').send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Token refreshed successfully');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // New refresh token should be different (rotation)
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('should reject refresh with missing token', async () => {
      const res = await api.post('/api/v1/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_REFRESH_TOKEN');
    });

    it('should reject refresh with invalid token', async () => {
      const res = await api.post('/api/v1/auth/refresh').send({
        refreshToken: 'invalid-token',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should reject refresh with empty token', async () => {
      const res = await api.post('/api/v1/auth/refresh').send({
        refreshToken: '   ',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EMPTY_REFRESH_TOKEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      await createTestUser({
        username: 'logoutuser',
        email: 'logout@test.com',
        password: 'password123',
      });

      const loginRes = await api.post('/api/v1/auth/login').send({
        identifier: 'logoutuser',
        password: 'password123',
      });

      accessToken = loginRes.body.accessToken;
      refreshToken = loginRes.body.refreshToken;
    });

    it('should logout successfully with refresh token only', async () => {
      const res = await api.post('/api/v1/auth/logout').send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');

      // Verify token is revoked - refresh should fail
      const refreshRes = await api.post('/api/v1/auth/refresh').send({
        refreshToken,
      });
      expect(refreshRes.status).toBe(401);
    });

    it('should logout successfully with both tokens', async () => {
      const res = await api.post('/api/v1/auth/logout').send({
        refreshToken,
        accessToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');
    });

    it('should reject logout with missing refresh token', async () => {
      const res = await api.post('/api/v1/auth/logout').send({
        accessToken,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_REFRESH_TOKEN');
    });

    it('should reject logout with non-existent refresh token', async () => {
      const res = await api.post('/api/v1/auth/logout').send({
        refreshToken: 'nonexistent-token',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('TOKEN_NOT_FOUND');
    });
  });

  describe('POST /api/v1/auth/revoke-all', () => {
    let accessToken;

    beforeEach(async () => {
      await createTestUser({
        username: 'revokeuser',
        email: 'revoke@test.com',
        password: 'password123',
      });

      const loginRes = await api.post('/api/v1/auth/login').send({
        identifier: 'revokeuser',
        password: 'password123',
      });

      accessToken = loginRes.body.accessToken;
    });

    it('should revoke all tokens successfully', async () => {
      const res = await api
        .post('/api/v1/auth/revoke-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('All tokens revoked successfully');
      expect(res.body.revokedCount).toBeGreaterThanOrEqual(0);
    });

    it('should reject without authentication', async () => {
      const res = await api.post('/api/v1/auth/revoke-all');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await api
        .post('/api/v1/auth/revoke-all')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/auth/validate-token', () => {
    let accessToken;

    beforeEach(async () => {
      await createTestUser({
        username: 'validateuser',
        email: 'validate@test.com',
        password: 'password123',
      });

      const loginRes = await api.post('/api/v1/auth/login').send({
        identifier: 'validateuser',
        password: 'password123',
      });

      accessToken = loginRes.body.accessToken;
    });

    it('should validate token successfully', async () => {
      const res = await api.post('/api/v1/auth/validate-token').send({
        token: accessToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('validateuser');
    });

    it('should return invalid for missing token', async () => {
      const res = await api.post('/api/v1/auth/validate-token').send({});

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBe('MISSING_TOKEN');
    });

    it('should return invalid for non-existent token', async () => {
      const res = await api.post('/api/v1/auth/validate-token').send({
        token: 'invalid-token',
      });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });
});
