import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://hooks.fyi" },
}));

const { ownerCookieName, buildOwnerCookieHeader, readOwnerCookie } =
  await import("@/lib/auth/owner-cookie");

const ID = "550e8400-e29b-41d4-a716-446655440000";

describe("owner-cookie helpers", () => {
  it("ownerCookieName scopes per hook", () => {
    expect(ownerCookieName(ID)).toBe(`hfyi_o_${ID}`);
  });

  it("buildOwnerCookieHeader sets HttpOnly + Path + SameSite=Lax + Secure", () => {
    const h = buildOwnerCookieHeader(ID, "tok123");
    expect(h).toContain(`hfyi_o_${ID}=tok123`);
    expect(h).toContain("HttpOnly");
    expect(h).toContain(`Path=/api/hooks/${ID}`);
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Secure");
    expect(h).toContain("Max-Age=");
  });

  it("readOwnerCookie returns the value when present", () => {
    const req = new Request("https://hooks.fyi/", {
      headers: { cookie: `hfyi_o_${ID}=tok123; other=x` },
    });
    expect(readOwnerCookie(req, ID)).toBe("tok123");
  });

  it("readOwnerCookie returns null when absent", () => {
    const req = new Request("https://hooks.fyi/", {
      headers: { cookie: "other=x" },
    });
    expect(readOwnerCookie(req, ID)).toBeNull();
  });

  it("readOwnerCookie returns null with no cookie header", () => {
    const req = new Request("https://hooks.fyi/");
    expect(readOwnerCookie(req, ID)).toBeNull();
  });
});
