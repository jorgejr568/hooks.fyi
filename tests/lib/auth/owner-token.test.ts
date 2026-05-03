import { describe, it, expect } from "vitest";
import {
  mintOwnerToken,
  hashOwnerToken,
  verifyOwnerToken,
} from "@/lib/auth/owner-token";

describe("owner-token utility", () => {
  it("mintOwnerToken returns a 43-char base64url token (32 bytes)", () => {
    const t = mintOwnerToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("two mints are different", () => {
    expect(mintOwnerToken()).not.toBe(mintOwnerToken());
  });

  it("hashOwnerToken is deterministic 64-char lowercase hex", () => {
    const t = "abc";
    const h1 = hashOwnerToken(t);
    const h2 = hashOwnerToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifyOwnerToken accepts the right token", () => {
    const t = mintOwnerToken();
    const h = hashOwnerToken(t);
    expect(verifyOwnerToken(t, h)).toBe(true);
  });

  it("verifyOwnerToken rejects a wrong token", () => {
    const a = mintOwnerToken();
    const b = mintOwnerToken();
    expect(verifyOwnerToken(b, hashOwnerToken(a))).toBe(false);
  });

  it("verifyOwnerToken is constant-time-safe (no early exit on length)", () => {
    const t = mintOwnerToken();
    const h = hashOwnerToken(t);
    // Different lengths must still return false without throwing.
    expect(verifyOwnerToken("", h)).toBe(false);
    expect(verifyOwnerToken("x".repeat(1000), h)).toBe(false);
  });

  it("verifyOwnerToken rejects null/undefined hash without throwing", () => {
    expect(verifyOwnerToken("abc", null)).toBe(false);
    expect(verifyOwnerToken("abc", undefined)).toBe(false);
  });
});
