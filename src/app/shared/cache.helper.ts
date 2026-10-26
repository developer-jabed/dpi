import { redis } from "./redis";


const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days – results almost never change after publish
const PREFIX = 'dpi:result:';

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (err) {
    console.error(`[Cache] GET failed ${key}:`, (err as Error).message);
    return null;
  }
};

export const setCache = async (key: string, value: unknown, ttl = CACHE_TTL) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.error(`[Cache] SET failed ${key}:`, (err as Error).message);
  }
};

/** Delete one or many keys efficiently */
export const invalidateResultCache = async (rolls: string | string[]) => {
  const list = Array.isArray(rolls) ? rolls : [rolls];
  if (!list.length) return;

  const keys = list.map((r) => `${PREFIX}${r.trim()}`);

  try {
    // pipeline is much faster on Upstash
    const pipeline = redis.pipeline();
    keys.forEach((k) => pipeline.del(k));
    await pipeline.exec();
    console.info(`[Cache] Invalidated ${keys.length} keys`);
  } catch (err) {
    console.error('[Cache] invalidate error:', (err as Error).message);
  }
};

/** Write many results at once (used after PDF parse) */
export const warmResultCache = async (
  items: Array<{ roll: string; data: unknown }>,
) => {
  if (!items.length) return;

  try {
    const pipeline = redis.pipeline();
    for (const { roll, data } of items) {
      const key = `${PREFIX}${roll.trim()}`;
      pipeline.set(key, JSON.stringify(data), 'EX', CACHE_TTL);
    }
    await pipeline.exec();
    console.info(`[Cache] Warmed ${items.length} rolls`);
  } catch (err) {
    console.error('[Cache] warm error:', (err as Error).message);
  }
};