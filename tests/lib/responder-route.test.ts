import { describe, it, expect, vi } from "vitest";
import { hashOwnerToken } from "@/lib/auth/owner-token";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { hook: { findUnique, update } },
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://hooks.fyi" },
}));
vi.mock("@/lib/log", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ID = "550e8400-e29b-41d4-a716-446655440000";
const { PUT } = await import("@/app/api/hooks/[hookId]/responder/route");

describe("PUT /api/hooks/:id/responder", () => {
  it("403s without owner token on non-legacy hook", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    const res = await PUT(
      new Request(`https://hooks.fyi/api/hooks/${ID}/responder`, {
        method: "PUT",
        body: JSON.stringify({ responderConfig: null }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ hookId: ID }) },
    );
    expect(res.status).toBe(403);
  });
});
