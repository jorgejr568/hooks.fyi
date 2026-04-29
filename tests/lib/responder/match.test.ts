import { describe, it, expect } from "vitest";
import { matchRule } from "@/lib/responder/match";
import type { RuleSpec } from "@/lib/responder/types";

const r = (p: Partial<RuleSpec>): RuleSpec => ({
  method: "*",
  pathGlob: "/**",
  status: "200",
  headers: [],
  body: "",
  delayMs: 0,
  ...p,
});

describe("matchRule", () => {
  it("returns null when there are no rules", () => {
    expect(matchRule([], "GET", "/x")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(
      matchRule([r({ method: "POST", pathGlob: "/users/*" })], "GET", "/x"),
    ).toBeNull();
  });

  it("first match wins", () => {
    const a = r({ method: "GET", pathGlob: "/x", status: "201" });
    const b = r({ method: "*", pathGlob: "/**", status: "299" });
    expect(matchRule([a, b], "GET", "/x")?.status).toBe("201");
    expect(matchRule([b, a], "GET", "/x")?.status).toBe("299");
  });

  it('treats "*" method as wildcard', () => {
    const rule = r({ method: "*", pathGlob: "/x" });
    expect(matchRule([rule], "DELETE", "/x")).toBe(rule);
  });

  it("compares method case-insensitively", () => {
    const rule = r({ method: "POST", pathGlob: "/x" });
    expect(matchRule([rule], "post", "/x")).toBe(rule);
  });
});
