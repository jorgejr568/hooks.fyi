import { describe, it, expect, vi } from "vitest";
import { hashOwnerToken } from "@/lib/auth/owner-token";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { hook: { findUnique } },
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://hooks.fyi" },
}));
vi.mock("@/lib/log", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { assertHookOwner } = await import("@/lib/auth/assert-owner");

const ID = "550e8400-e29b-41d4-a716-446655440000";

function req(headers: Record<string, string> = {}) {
  return new Request("https://hooks.fyi/api/hooks/" + ID, { headers });
}

describe("assertHookOwner", () => {
  it("returns null when the hook is missing (caller handles 404)", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await assertHookOwner(req(), ID)).toBeNull();
  });

  it("returns null when ownerTokenHash is null (legacy hook)", async () => {
    findUnique.mockResolvedValueOnce({ ownerTokenHash: null });
    expect(await assertHookOwner(req(), ID)).toBeNull();
  });

  it("returns null for the right token via Authorization header", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    expect(
      await assertHookOwner(req({ authorization: "Bearer tok" }), ID),
    ).toBeNull();
  });

  it("returns null for the right token via cookie", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    expect(
      await assertHookOwner(req({ cookie: `hfyi_o_${ID}=tok` }), ID),
    ).toBeNull();
  });

  it("returns 403 with no token", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("tok"),
    });
    const res = await assertHookOwner(req(), ID);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("returns 403 with a wrong token", async () => {
    findUnique.mockResolvedValueOnce({
      ownerTokenHash: hashOwnerToken("real"),
    });
    const res = await assertHookOwner(
      req({ authorization: "Bearer wrong" }),
      ID,
    );
    expect(res!.status).toBe(403);
  });
});
