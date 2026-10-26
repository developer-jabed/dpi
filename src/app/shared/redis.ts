import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  tls: {},                     // required for Upstash
  enableReadyCheck: true,
  lazyConnect: false,
  // Upstash free tier friendly
  connectTimeout: 10_000,
  commandTimeout: 5_000,
});

redis.on('connect', () => console.log('Redis connected ✅'));
redis.on('error', (err) => console.error('Redis error ❌', err.message));
redis.on('ready', () => console.log('Redis ready'));