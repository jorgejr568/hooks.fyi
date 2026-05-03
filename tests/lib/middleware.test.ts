import { describe, it, expect } from "vitest";
import { middleware } from "@/middleware";

describe("middleware security headers", () => {
  it("sets baseline headers on app pages", async () => {
    const res = await middleware(
      new Request("https://hooks.fyi/some/path") as never,
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("strict-transport-security")).toContain(
      "max-age=",
    );
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
    // The script-src directive carries a per-request nonce so Next's
    // inline hydration scripts are allowed without 'unsafe-inline'.
    expect(csp).toMatch(/script-src [^;]*'nonce-[a-f0-9]+'/);
    // Cloudflare's edge-injected analytics beacon is host-allowlisted.
    expect(csp).toContain("https://static.cloudflareinsights.com");
  });

  it("omits CSP on /h/* (webhook ingest)", async () => {
    const res = await middleware(
      new Request("https://hooks.fyi/h/abc-123") as never,
    );
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("omits CSP on /api/files/* (download)", async () => {
    const res = await middleware(
      new Request("https://hooks.fyi/api/files/x/y.png") as never,
    );
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("omits HSTS on http://", async () => {
    const res = await middleware(
      new Request("http://localhost:3000/") as never,
    );
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});
