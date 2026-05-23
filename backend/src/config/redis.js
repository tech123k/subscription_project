const logger = require('../utils/logger');

// Redis is optional — if REDIS_ENABLED is not 'true', all cache calls are no-ops
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

let client = null;

const getRedisClient = async () => {
  if (!REDIS_ENABLED) return null;
  if (client && client.isReady) return client;

  const { createClient } = require('redis');
  const useTLS = process.env.REDIS_TLS === 'true';
  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      tls: useTLS,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          logger.warn('Redis max retries reached — disabling cache');
          return false;
        }
        return Math.min(retries * 500, 3000);
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  client.on('error', (err) => logger.warn('Redis:', err.message));
  client.on('connect', () => logger.info('Redis connected'));

  try {
    await client.connect();
  } catch (err) {
    logger.warn('Redis unavailable — running without cache');
    client = null;
  }
  return client;
};

const setCache = async (key, value, ttlSeconds = 300) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
};

const getCache = async (key) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(key);
  } catch { /* silent */ }
};

const deleteCachePattern = async (pattern) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  } catch { /* silent */ }
};

module.exports = { getRedisClient, setCache, getCache, deleteCache, deleteCachePattern };
