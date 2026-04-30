import { env } from "./env";
import { getRedis } from "./redis";
import { logger } from "./log";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
};

export async function checkHookRateLimit(
  hookId: string,
): Promise<RateLimitResult> {
  const limit = env.RATE_LIMIT_PER_HOOK;
  const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS;

  if (limit <= 0) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetSeconds: windowSeconds,
    };
  }

  const redis = getRedis();
  if (!redis) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetSeconds: windowSeconds,
    };
  }

  const key = `rl:hook:${hookId}`;
  try {
    // Fixed-window counter. On the first hit of a window INCR returns 1 and
    // we seed the TTL; subsequent hits within the same window just bump the
    // counter. PTTL feeds Retry-After.
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    const pttl = await redis.pttl(key);
    const resetSeconds = pttl > 0 ? Math.ceil(pttl / 1000) : windowSeconds;
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, limit, remaining, resetSeconds };
  } catch (err) {
    // Fail-open: a broken Redis must not take down the ingest path.
    logger.warn(
      { err: (err as Error).message, hookId },
      "rate limit check failed; allowing request",
    );
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetSeconds: windowSeconds,
    };
  }
}
