import { describe, it, expect, vi, beforeEach } from "vitest";

class FakeRedis {
  private c = new Map<string, number>();
  async incr(k: string) {
    const n = (this.c.get(k) ?? 0) + 1;
    this.c.set(k, n);
    return n;
  }
  async expire() { return 1; }
  async pttl() { return 60_000; }
}
const fake = new FakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => fake }));
vi.mock("@/lib/env", () => ({
  env: {
    RATE_LIMIT_CREATE_PER_IP: 2,
    RATE_LIMIT_CREATE_WINDOW_SECONDS: 60,
    NEXT_PUBLIC_APP_URL: "https://hooks.fyi",
    RATE_LIMIT_PER_HOOK: 100,
    RATE_LIMIT_WINDOW_SECONDS: 60,
  },
}));

const create = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { hook: { create } } }));

const { POST } = await import("@/app/api/hooks/route");

function reqWith(ip: string) {
  return new Request("https://hooks.fyi/api/hooks", {
    method: "POST",
    body: "{}",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
  });
}

describe("POST /api/hooks per-IP rate limit", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: new Date(),
    });
  });

  it("allows up to N then 429s the (N+1)th from the same IP", async () => {
    const r1 = await POST(reqWith("9.9.9.9"));
    const r2 = await POST(reqWith("9.9.9.9"));
    const r3 = await POST(reqWith("9.9.9.9"));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(429);
    expect(r3.headers.get("retry-after")).toBeTruthy();
  });

  it("counts different IPs separately", async () => {
    await POST(reqWith("1.1.1.1"));
    await POST(reqWith("1.1.1.1"));
    const r3 = await POST(reqWith("2.2.2.2"));
    expect(r3.status).toBe(201);
  });
});
