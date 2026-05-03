import { describe, it, expect } from "vitest";
import {
  responderConfigSchema,
  safeParseResponderConfig,
  MAX_BODY_LEN,
  MAX_DELAY_MS,
} from "@/lib/responder/schema";
import type { ResponderConfig } from "@/lib/responder/types";

const baseDefault = {
  status: "200",
  headers: [],
  body: "",
  delayMs: 0,
};

const validConfig: ResponderConfig = {
  default: { ...baseDefault },
  rules: [
    {
      ...baseDefault,
      method: "POST",
      pathGlob: "/users/*",
      status: "201",
      body: "ok",
    },
  ],
};

describe("responderConfigSchema", () => {
  it("accepts a fully valid config", () => {
    expect(() => responderConfigSchema.parse(validConfig)).not.toThrow();
  });

  it("accepts an empty rules list", () => {
    expect(() =>
      responderConfigSchema.parse({ default: baseDefault, rules: [] }),
    ).not.toThrow();
  });

  it("rejects negative delay", () => {
    const r = safeParseResponderConfig({
      default: { ...baseDefault, delayMs: -1 },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects delay above MAX_DELAY_MS", () => {
    const r = safeParseResponderConfig({
      default: { ...baseDefault, delayMs: MAX_DELAY_MS + 1 },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects body above MAX_BODY_LEN", () => {
    const r = safeParseResponderConfig({
      default: { ...baseDefault, body: "x".repeat(MAX_BODY_LEN + 1) },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown method", () => {
    const r = safeParseResponderConfig({
      default: baseDefault,
      rules: [
        {
          ...baseDefault,
          method: "BREW" as unknown as string,
          pathGlob: "/x",
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty pathGlob", () => {
    const r = safeParseResponderConfig({
      default: baseDefault,
      rules: [{ ...baseDefault, method: "GET", pathGlob: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty status", () => {
    const r = safeParseResponderConfig({
      default: { ...baseDefault, status: "" },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects header with empty name after trim", () => {
    const r = safeParseResponderConfig({
      default: { ...baseDefault, headers: [{ name: "   ", value: "x" }] },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts wildcard method *", () => {
    const r = safeParseResponderConfig({
      default: baseDefault,
      rules: [{ ...baseDefault, method: "*", pathGlob: "/**" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("header injection", () => {
  it("rejects CRLF in a header name", () => {
    const r = safeParseResponderConfig({
      default: {
        ...baseDefault,
        headers: [{ name: "X-Foo\r\nSet-Cookie: x=1", value: "v" }],
      },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects spaces in a header name", () => {
    const r = safeParseResponderConfig({
      default: {
        ...baseDefault,
        headers: [{ name: "X Foo", value: "v" }],
      },
      rules: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a normal header name", () => {
    const r = safeParseResponderConfig({
      default: {
        ...baseDefault,
        headers: [{ name: "X-Custom-Header", value: "v" }],
      },
      rules: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects CR/LF/NUL in a header value", () => {
    for (const ch of ["\r", "\n", "\0"]) {
      const r = safeParseResponderConfig({
        default: {
          ...baseDefault,
          headers: [{ name: "X-Foo", value: `bad${ch}injected` }],
        },
        rules: [],
      });
      expect(r.success).toBe(false);
    }
  });
});
