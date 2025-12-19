import request from 'supertest';
import { vi, beforeAll, afterAll } from 'vitest';
import app from '../../main.js';
import { connectDB, disconnectDB } from '../../src/db.js';
import User from '../../src/models/User.js';
import Profile from '../../src/models/Profile.js';
import {
  createRedisClient,
  disconnectRedis,
  getRedisClient,
} from '../../src/config/redis.js';

// Setup database connections for integration tests
beforeAll(async () => {
  await connectDB();
  createRedisClient();
});

afterAll(async () => {
  await disconnectRedis();
  await disconnectDB();
});

// Clean up database between tests in integration tests
export const cleanupDatabase = async () => {
  try {
    await User.deleteMany({});
    await Profile.deleteMany({});
  } catch (error) {
    console.error('Error cleaning up database:', error);
  }
};

// Clean up Redis between tests
export const cleanupRedis = async () => {
  try {
    const redis = getRedisClient();
    // Clear all keys used in tests (use with caution in production)
    const keys = await redis.keys('access_token:*');
    const refreshKeys = await redis.keys('refresh_token:*');
    const userTokenKeys = await redis.keys('user_tokens:*');
    const tokenMapKeys = await redis.keys('token_map:*');

    const allKeys = [
      ...keys,
      ...refreshKeys,
      ...userTokenKeys,
      ...tokenMapKeys,
    ];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch (error) {
    console.error('Error cleaning up Redis:', error);
  }
};

// Helper to create a test user and get tokens
export const createTestUser = async (userData = {}) => {
  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@test.com`,
    password: 'testPassword123',
    roles: ['beatmaker'],
    ...userData,
  };

  const user = await User.create(defaultUser);

  // Create associated profile
  const profile = await Profile.create({
    userId: user._id,
    username: user.username,
    email: user.email,
    about_me: '',
    avatar: '',
    full_name: '',
    contact: {
      phone: '',
      city: '',
      country: '',
      website: '',
      social_media: {
        instagram: '',
        twitter: '',
        youtube: '',
        soundcloud: '',
        spotify: '',
      },
    },
    studies: [],
    tags: [],
    certifications: [],
  });

  return { user, profile, password: defaultUser.password };
};

// Helper to create admin user
export const createTestAdmin = async (userData = {}) => {
  return createTestUser({
    username: `admin_${Date.now()}`,
    email: `admin_${Date.now()}@test.com`,
    roles: ['admin'],
    ...userData,
  });
};

// Helper to login and get tokens
export const loginTestUser = async (identifier, password) => {
  const response = await api
    .post('/api/v1/auth/login')
    .send({ identifier, password });

  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
};

// Export a ready-to-use Supertest instance
export const api = request(app);
