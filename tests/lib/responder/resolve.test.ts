import { describe, it, expect } from "vitest";
import { resolveResponse } from "@/lib/responder/resolve";
import type {
  ResponderConfig,
  ResponseSpec,
  RuleSpec,
} from "@/lib/responder/types";
import type { ParsedRequest } from "@/lib/ingest/types";

const baseSpec = (over: Partial<ResponseSpec> = {}): ResponseSpec => ({
  status: "200",
  headers: [],
  body: "",
  delayMs: 0,
  ...over,
});

const rule = (over: Partial<RuleSpec>): RuleSpec => ({
  ...baseSpec(),
  method: "*",
  pathGlob: "/**",
  ...over,
});

const parsed = (over: Partial<ParsedRequest> = {}): ParsedRequest => ({
  method: "POST",
  path: "/orders",
  query: {},
  headers: {},
  contentType: "application/json",
  body: '{"order":{"id":"X1"}}',
  bodyTruncated: false,
  bodySize: 0,
  files: [],
  rawBody: null,
  ip: null,
  userAgent: null,
  ...over,
});

describe("resolveResponse", () => {
  it("falls back to default when no rules match", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({ status: "418", body: "teapot" }),
      rules: [rule({ method: "GET", pathGlob: "/health" })],
    };
    const out = resolveResponse(cfg, parsed());
    expect(out.status).toBe(418);
    expect(out.body).toBe("teapot");
  });

  it("rule wins over default", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({ status: "500" }),
      rules: [rule({ method: "POST", pathGlob: "/orders", status: "201" })],
    };
    expect(resolveResponse(cfg, parsed()).status).toBe(201);
  });

  it("clamps invalid status to 500", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({ status: "not-a-number" }),
      rules: [],
    };
    expect(resolveResponse(cfg, parsed()).status).toBe(500);
  });

  it("clamps delay to MAX_DELAY_MS", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({ delayMs: 999_999 }),
      rules: [],
    };
    expect(resolveResponse(cfg, parsed()).delayMs).toBe(30_000);
  });

  it("renders templated body, status, and header value", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({
        status: "{{request.json.order.code}}",
        body: "Order {{request.json.order.id}} from {{request.method}}",
        headers: [{ name: "X-Order", value: "{{request.json.order.id}}" }],
      }),
      rules: [],
    };
    const out = resolveResponse(
      cfg,
      parsed({ body: '{"order":{"id":"X1","code":"201"}}' }),
    );
    expect(out.status).toBe(201);
    expect(out.body).toBe("Order X1 from POST");
    expect(out.headers).toEqual([["X-Order", "X1"]]);
  });

  it("skips headers with empty name", () => {
    const cfg: ResponderConfig = {
      default: baseSpec({
        headers: [
          { name: "  ", value: "ignored" },
          { name: "X-Real", value: "kept" },
        ],
      }),
      rules: [],
    };
    expect(resolveResponse(cfg, parsed()).headers).toEqual([
      ["X-Real", "kept"],
    ]);
  });
});
