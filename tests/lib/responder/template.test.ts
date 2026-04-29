import { describe, it, expect } from "vitest";
import { render, buildContext } from "@/lib/responder/template";
import type { ParsedRequest } from "@/lib/ingest/types";
import type { RenderContext } from "@/lib/responder/types";

function ctx(over: Partial<RenderContext["request"]> = {}): RenderContext {
  return {
    request: {
      method: "POST",
      path: "/orders/42",
      query: { ref: "abc" },
      headers: { "x-foo": "bar", "content-type": "application/json" },
      body: '{"order":{"id":"X1","amount":99}}',
      json: { order: { id: "X1", amount: 99 } },
      ...over,
    },
  };
}

describe("render", () => {
  it("returns the template unchanged when no expressions", () => {
    expect(render("plain text", ctx())).toBe("plain text");
  });

  it("resolves request.method, path, body", () => {
    expect(render("{{request.method}} {{request.path}}", ctx())).toBe(
      "POST /orders/42",
    );
    expect(render("body={{request.body}}", ctx())).toContain("X1");
  });

  it("resolves query keys", () => {
    expect(render("{{request.query.ref}}", ctx())).toBe("abc");
    expect(render("{{request.query.missing}}", ctx())).toBe("");
  });

  it("walks JSON dot path and serializes non-string leaves", () => {
    expect(render("{{request.json.order.id}}", ctx())).toBe("X1");
    expect(render("{{request.json.order.amount}}", ctx())).toBe("99");
    expect(render("{{request.json.missing.nope}}", ctx())).toBe("");
  });

  it("renders empty when json is undefined", () => {
    expect(render("{{request.json.x}}", ctx({ json: undefined }))).toBe("");
  });

  it("looks up headers case-insensitively via helper", () => {
    expect(render('{{request.header "X-Foo"}}', ctx())).toBe("bar");
    expect(render("{{request.header 'x-foo'}}", ctx())).toBe("bar");
    expect(render('{{request.header "Missing"}}', ctx())).toBe("");
  });

  it("provides now and uuid helpers", () => {
    const out = render("{{now}}", ctx());
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(render("{{now.unix}}", ctx())).toMatch(/^\d{10}$/);
    expect(render("{{uuid}}", ctx())).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("renders unknown expressions as empty string", () => {
    expect(render("[{{nope}}]", ctx())).toBe("[]");
    expect(render("[{{request.foo}}]", ctx())).toBe("[]");
  });

  it("emits everything literal after an unclosed expression", () => {
    expect(render("hello {{request.method", ctx())).toBe(
      "hello {{request.method",
    );
  });

  it("interpolates multiple expressions", () => {
    expect(
      render(
        "{{request.method}} order {{request.json.order.id}} ({{request.query.ref}})",
        ctx(),
      ),
    ).toBe("POST order X1 (abc)");
  });
});

describe("buildContext", () => {
  const baseParsed: ParsedRequest = {
    method: "POST",
    path: "/x",
    query: {},
    headers: {},
    contentType: "application/json",
    body: '{"a":1}',
    bodyTruncated: false,
    bodySize: 7,
    files: [],
    rawBody: null,
    ip: null,
    userAgent: null,
  };

  it("parses JSON when content-type is JSON", () => {
    const c = buildContext(baseParsed);
    expect(c.request.json).toEqual({ a: 1 });
  });

  it("leaves json undefined for non-JSON content-type", () => {
    const c = buildContext({
      ...baseParsed,
      contentType: "text/plain",
      body: '{"a":1}',
    });
    expect(c.request.json).toBeUndefined();
  });

  it("handles invalid JSON gracefully", () => {
    const c = buildContext({ ...baseParsed, body: "not json" });
    expect(c.request.json).toBeUndefined();
  });

  it("substitutes empty string for null body", () => {
    const c = buildContext({ ...baseParsed, body: null });
    expect(c.request.body).toBe("");
  });

  it("recognizes application/*+json content-type", () => {
    const c = buildContext({
      ...baseParsed,
      contentType: "application/vnd.api+json",
    });
    expect(c.request.json).toEqual({ a: 1 });
  });
});
