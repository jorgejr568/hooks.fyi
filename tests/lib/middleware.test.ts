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
  });

  it("does not set CSP (Cloudflare-injected scripts conflict)", async () => {
    const res = await middleware(
      new Request("https://hooks.fyi/some/path") as never,
    );
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("sets the same baseline headers on /h/* (webhook ingest)", async () => {
    const res = await middleware(
      new Request("https://hooks.fyi/h/abc-123") as never,
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("omits HSTS on http://", async () => {
    const res = await middleware(
      new Request("http://localhost:3000/") as never,
    );
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});
