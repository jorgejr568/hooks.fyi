import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./log";

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  const url = env.REDIS_URL;
  if (!url) {
    globalForRedis.redis = null;
    return null;
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => logger.warn({ err: err.message }, "redis error"));
  globalForRedis.redis = client;
  return client;
}
