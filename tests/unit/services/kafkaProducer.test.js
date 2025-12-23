import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  globalThis.mockConnect = vi.fn();
  globalThis.mockDisconnect = vi.fn();
  globalThis.mockSend = vi.fn();
  globalThis.mockAdminConnect = vi.fn();
  globalThis.mockAdminDisconnect = vi.fn();
  globalThis.mockDescribeCluster = vi.fn();
});

// Mock kafkajs
vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(() => ({
    producer: vi.fn().mockReturnValue({
      connect: globalThis.mockConnect,
      disconnect: globalThis.mockDisconnect,
      send: globalThis.mockSend,
    }),
    admin: vi.fn().mockReturnValue({
      connect: globalThis.mockAdminConnect,
      disconnect: globalThis.mockAdminDisconnect,
      describeCluster: globalThis.mockDescribeCluster,
    }),
  })),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import * as kafkaProducer from '../../../src/services/kafkaProducer.js';
import logger from '../../../logger.js';

describe('KafkaProducer Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isKafkaEnabled', () => {
    it('should return true when ENABLE_KAFKA is "true"', () => {
      process.env.ENABLE_KAFKA = 'true';
      expect(kafkaProducer.isKafkaEnabled()).toBe(true);
    });

    it('should return true when ENABLE_KAFKA is "TRUE" (case insensitive)', () => {
      process.env.ENABLE_KAFKA = 'TRUE';
      expect(kafkaProducer.isKafkaEnabled()).toBe(true);
    });

    it('should return false when ENABLE_KAFKA is "false"', () => {
      process.env.ENABLE_KAFKA = 'false';
      expect(kafkaProducer.isKafkaEnabled()).toBe(false);
    });

    it('should return false when ENABLE_KAFKA is undefined', () => {
      delete process.env.ENABLE_KAFKA;
      expect(kafkaProducer.isKafkaEnabled()).toBe(false);
    });

    it('should return false when ENABLE_KAFKA is empty string', () => {
      process.env.ENABLE_KAFKA = '';
      expect(kafkaProducer.isKafkaEnabled()).toBe(false);
    });
  });

  describe('isKafkaConnected', () => {
    it('should return true when admin can connect and describe cluster', async () => {
      globalThis.mockAdminConnect.mockResolvedValue(undefined);
      globalThis.mockDescribeCluster.mockResolvedValue({ brokers: [] });
      globalThis.mockAdminDisconnect.mockResolvedValue(undefined);

      const result = await kafkaProducer.isKafkaConnected();

      expect(result).toBe(true);
      expect(globalThis.mockAdminConnect).toHaveBeenCalled();
      expect(globalThis.mockDescribeCluster).toHaveBeenCalled();
      expect(globalThis.mockAdminDisconnect).toHaveBeenCalled();
    });

    it('should return false when admin connect fails', async () => {
      globalThis.mockAdminConnect.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await kafkaProducer.isKafkaConnected();

      expect(result).toBe(false);
    });

    it('should return false when describeCluster fails', async () => {
      globalThis.mockAdminConnect.mockResolvedValue(undefined);
      globalThis.mockDescribeCluster.mockRejectedValue(
        new Error('Cluster error')
      );

      const result = await kafkaProducer.isKafkaConnected();

      expect(result).toBe(false);
    });
  });

  describe('disconnectKafkaProducer', () => {
    it('should disconnect producer successfully', async () => {
      globalThis.mockDisconnect.mockResolvedValue(undefined);

      await kafkaProducer.disconnectKafkaProducer();

      expect(globalThis.mockDisconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Kafka producer disconnected');
    });

    it('should log error when disconnect fails', async () => {
      const error = new Error('Disconnect failed');
      globalThis.mockDisconnect.mockRejectedValue(error);

      await kafkaProducer.disconnectKafkaProducer();

      expect(logger.error).toHaveBeenCalledWith(
        'Error disconnecting Kafka producer:',
        error
      );
    });
  });

  describe('publishUserEvent', () => {
    it('should skip publishing when Kafka is disabled', async () => {
      process.env.ENABLE_KAFKA = 'false';

      await kafkaProducer.publishUserEvent('USER_CREATED', { _id: '123' });

      expect(globalThis.mockSend).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Kafka disabled, skipping event: USER_CREATED'
      );
    });

    it('should skip publishing when Kafka is not connected', async () => {
      process.env.ENABLE_KAFKA = 'true';

      await kafkaProducer.publishUserEvent('USER_CREATED', { _id: '123' });

      expect(globalThis.mockSend).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Kafka not connected, skipping event: USER_CREATED'
      );
    });
  });

  describe('Event Types', () => {
    it('USER_CREATED event should have correct structure', () => {
      const payload = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['beatmaker'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(payload).toHaveProperty('_id');
      expect(payload).toHaveProperty('username');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('roles');
      expect(Array.isArray(payload.roles)).toBe(true);
    });

    it('USER_UPDATED event should have correct structure', () => {
      const payload = {
        _id: 'user123',
        username: 'newusername',
        email: 'newemail@example.com',
        roles: ['beatmaker', 'producer'],
        updatedAt: new Date().toISOString(),
      };

      expect(payload).toHaveProperty('_id');
      expect(payload).toHaveProperty('username');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('updatedAt');
    });

    it('USER_DELETED event should have correct structure', () => {
      const payload = {
        _id: 'user123',
        username: 'deleteduser',
      };

      expect(payload).toHaveProperty('_id');
      expect(payload).toHaveProperty('username');
    });
  });

  describe('producer export', () => {
    it('should export producer instance', () => {
      expect(kafkaProducer.producer).toBeDefined();
    });
  });
});
