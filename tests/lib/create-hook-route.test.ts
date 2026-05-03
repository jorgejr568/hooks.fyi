import { describe, it, expect, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { hook: { create } },
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://hooks.fyi" },
}));

const { POST } = await import("@/app/api/hooks/route");

describe("POST /api/hooks", () => {
  beforeEach(() => create.mockReset());

  it("issues an owner token, stores its hash, and sets the cookie", async () => {
    create.mockImplementationOnce(async (args: unknown) => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: new Date("2026-05-03T00:00:00Z"),
    }));

    const res = await POST(
      new Request("https://hooks.fyi/api/hooks", {
        method: "POST",
        body: JSON.stringify({ name: "x" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; ownerToken: string };
    expect(body.ownerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain(
      `hfyi_o_550e8400-e29b-41d4-a716-446655440000=${body.ownerToken}`,
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain(
      "Path=/api/hooks/550e8400-e29b-41d4-a716-446655440000",
    );

    // The persisted record stores the *hash*, not the raw token.
    const persisted = create.mock.calls[0][0].data as {
      ownerTokenHash: string;
    };
    expect(persisted.ownerTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(persisted.ownerTokenHash).not.toBe(body.ownerToken);
  });
});
