import { describe, it, expect } from "vitest";
import { globToRegex, pathMatches } from "@/lib/responder/glob";

describe("globToRegex / pathMatches", () => {
  it("matches a single segment with *", () => {
    expect(pathMatches("/users/*", "/users/42")).toBe(true);
    expect(pathMatches("/users/*", "/users/42/")).toBe(true);
    expect(pathMatches("/users/*", "/users/42/posts")).toBe(false);
    expect(pathMatches("/users/*", "/users/")).toBe(false);
  });

  it("matches multiple segments with **", () => {
    expect(pathMatches("/api/**", "/api")).toBe(true);
    expect(pathMatches("/api/**", "/api/")).toBe(true);
    expect(pathMatches("/api/**", "/api/v1/users/42")).toBe(true);
    expect(pathMatches("/api/**", "/other")).toBe(false);
  });

  it("escapes regex metachars", () => {
    expect(pathMatches("/a.b+c?d", "/a.b+c?d")).toBe(true);
    expect(pathMatches("/a.b+c?d", "/aXbYcZd")).toBe(false);
  });

  it("anchors the match", () => {
    expect(pathMatches("/users", "/users/42")).toBe(false);
    expect(pathMatches("/users", "/zzz/users")).toBe(false);
  });

  it("treats trailing slash as equivalent on both sides", () => {
    expect(pathMatches("/health/", "/health")).toBe(true);
    expect(pathMatches("/health", "/health/")).toBe(true);
  });

  it("rejects empty glob", () => {
    expect(() => globToRegex("")).toThrow();
  });

  it("supports root-level catch-all", () => {
    expect(pathMatches("/**", "/")).toBe(true);
    expect(pathMatches("/**", "/x/y/z")).toBe(true);
  });
});
