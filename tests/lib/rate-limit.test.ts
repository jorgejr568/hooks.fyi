import { describe, it, expect, beforeEach, vi } from "vitest";

// Fake Redis with a fixed-window counter, sufficient for what rate-limit.ts
// needs: incr(), expire(), pttl().
class FakeRedis {
  private counts = new Map<string, number>();
  private ttlMs = new Map<string, number>();
  now = 0;

  async incr(key: string) {
    this.expireIfDue(key);
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async expire(key: string, seconds: number) {
    this.ttlMs.set(key, this.now + seconds * 1000);
    return 1;
  }
  async pttl(key: string) {
    this.expireIfDue(key);
    const expiresAt = this.ttlMs.get(key);
    if (expiresAt === undefined) return -1;
    return Math.max(0, expiresAt - this.now);
  }
  advance(ms: number) {
    this.now += ms;
  }
  private expireIfDue(key: string) {
    const expiresAt = this.ttlMs.get(key);
    if (expiresAt !== undefined && this.now >= expiresAt) {
      this.counts.delete(key);
      this.ttlMs.delete(key);
    }
  }
}

const fake = new FakeRedis();

vi.mock("@/lib/redis", () => ({
  getRedis: () => fake,
}));

vi.mock("@/lib/env", () => ({
  env: {
    RATE_LIMIT_PER_HOOK: 3,
    RATE_LIMIT_WINDOW_SECONDS: 60,
  },
}));

const { checkHookRateLimit } = await import("@/lib/rate-limit");

describe("checkHookRateLimit", () => {
  beforeEach(() => {
    // Reset fake state between tests.
    Object.assign(fake, new FakeRedis());
  });

  it("allows the first N requests and rejects the (N+1)th", async () => {
    const id = "hook-a";
    const r1 = await checkHookRateLimit(id);
    const r2 = await checkHookRateLimit(id);
    const r3 = await checkHookRateLimit(id);
    const r4 = await checkHookRateLimit(id);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("isolates counters per hook", async () => {
    await checkHookRateLimit("hook-a");
    await checkHookRateLimit("hook-a");
    await checkHookRateLimit("hook-a");
    const blocked = await checkHookRateLimit("hook-a");
    const fresh = await checkHookRateLimit("hook-b");

    expect(blocked.allowed).toBe(false);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });

  it("resets after the window elapses", async () => {
    const id = "hook-c";
    await checkHookRateLimit(id);
    await checkHookRateLimit(id);
    await checkHookRateLimit(id);
    expect((await checkHookRateLimit(id)).allowed).toBe(false);

    fake.advance(60_001);
    const reset = await checkHookRateLimit(id);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(2);
  });

  it("reports a sane resetSeconds within the window", async () => {
    const r = await checkHookRateLimit("hook-d");
    expect(r.resetSeconds).toBeGreaterThan(0);
    expect(r.resetSeconds).toBeLessThanOrEqual(60);
  });
});
