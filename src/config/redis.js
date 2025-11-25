import Redis from 'ioredis';
import logger from '../../logger.js';

let redisClient = null;

/**
 * Crea y configura el cliente de Redis
 * @returns {Redis} - Cliente de Redis configurado
 */
export const createRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  redisClient = new Redis(redisConfig);

  redisClient.on('connect', () => {
    logger.info('Redis client connected successfully');
  });

  redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redisClient;
};

/**
 * Obtiene el cliente de Redis existente
 * @returns {Redis} - Cliente de Redis
 */
export const getRedisClient = () => {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
};

/**
 * Cierra la conexión de Redis
 */
export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected successfully');
  }
};

export default { createRedisClient, getRedisClient, disconnectRedis };
