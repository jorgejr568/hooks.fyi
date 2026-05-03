import { describe, it, expect, vi } from "vitest";

class FakeRedis {
  counts = new Map<string, number>();
  async incr(k: string) {
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
  async decr(k: string) {
    const n = Math.max(0, (this.counts.get(k) ?? 0) - 1);
    this.counts.set(k, n);
    return n;
  }
}
const fake = new FakeRedis();

vi.mock("@/lib/redis", () => ({ getRedis: () => fake }));
vi.mock("@/lib/env", () => ({
  env: { SSE_MAX_CONNECTIONS_PER_IP: 2, TRUSTED_PROXY_IPS: "" },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { hook: { findUnique: vi.fn().mockResolvedValue({ id: "x" }) } },
}));
vi.mock("@/lib/events/hook-events", () => ({
  hookEvents: { subscribe: () => () => {} },
}));

const { GET } = await import("@/app/api/hooks/[hookId]/stream/route");
const ID = "550e8400-e29b-41d4-a716-446655440000";

function req() {
  return new Request(`https://hooks.fyi/api/hooks/${ID}/stream`, {
    headers: { "x-real-ip": "9.9.9.9" },
  });
}

describe("SSE per-IP cap", () => {
  it("returns 429 once the cap is reached", async () => {
    const r1 = await GET(req(), { params: Promise.resolve({ hookId: ID }) });
    const r2 = await GET(req(), { params: Promise.resolve({ hookId: ID }) });
    const r3 = await GET(req(), { params: Promise.resolve({ hookId: ID }) });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});
