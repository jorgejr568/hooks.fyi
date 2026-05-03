import { describe, it, expect, vi } from "vitest";
import { hashOwnerToken } from "@/lib/auth/owner-token";

const findUnique = vi.fn();
const update = vi.fn();
const deleteFn = vi.fn();
const deletePrefix = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hook: { findUnique, update, delete: deleteFn },
  },
}));
vi.mock("@/lib/s3", () => ({ deletePrefix }));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://hooks.fyi" },
}));
vi.mock("@/lib/log", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ID = "550e8400-e29b-41d4-a716-446655440000";

const { PATCH, DELETE } = await import("@/app/api/hooks/[hookId]/route");

describe("PATCH /api/hooks/:id", () => {
  it("403s without an owner token on a non-legacy hook", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    const res = await PATCH(
      new Request("https://hooks.fyi/api/hooks/" + ID, {
        method: "PATCH",
        body: JSON.stringify({ name: "x" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ hookId: ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("succeeds with the right Bearer token", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    update.mockResolvedValueOnce({
      id: ID,
      name: "x",
      createdAt: new Date("2026-05-03T00:00:00Z"),
    });
    const res = await PATCH(
      new Request("https://hooks.fyi/api/hooks/" + ID, {
        method: "PATCH",
        body: JSON.stringify({ name: "x" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer tok",
        },
      }),
      { params: Promise.resolve({ hookId: ID }) },
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/hooks/:id", () => {
  it("403s without an owner token on a non-legacy hook", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    const res = await DELETE(
      new Request("https://hooks.fyi/api/hooks/" + ID, { method: "DELETE" }),
      { params: Promise.resolve({ hookId: ID }) },
    );
    expect(res.status).toBe(403);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
