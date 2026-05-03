import { describe, it, expect, vi } from "vitest";

function makeReq(headers: Record<string, string>) {
  return new Request("https://hooks.fyi/", { headers });
}

describe("clientIp", () => {
  it("uses XFF[0] only when peerIp is in TRUSTED_PROXY_IPS", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { TRUSTED_PROXY_IPS: "10.0.0.0/8" } }));
    const { clientIp } = await import("@/lib/ingest/client-ip");
    expect(clientIp(makeReq({ "x-forwarded-for": "1.2.3.4, 10.0.0.5" }), "10.0.0.5"))
      .toBe("1.2.3.4");
  });

  it("ignores XFF when peerIp is not trusted", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { TRUSTED_PROXY_IPS: "10.0.0.0/8" } }));
    const { clientIp } = await import("@/lib/ingest/client-ip");
    expect(clientIp(makeReq({ "x-forwarded-for": "1.2.3.4" }), "8.8.8.8"))
      .toBe("8.8.8.8");
  });

  it("falls back to x-real-ip when no XFF and peer unknown", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { TRUSTED_PROXY_IPS: "" } }));
    const { clientIp } = await import("@/lib/ingest/client-ip");
    expect(clientIp(makeReq({ "x-real-ip": "9.9.9.9" }), null))
      .toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing is available", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { TRUSTED_PROXY_IPS: "" } }));
    const { clientIp } = await import("@/lib/ingest/client-ip");
    expect(clientIp(makeReq({}), null)).toBe("unknown");
  });
});
