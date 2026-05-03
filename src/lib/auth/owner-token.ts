import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** 32 bytes → base64url (43 chars, no padding). */
export function mintOwnerToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hex-encoded SHA-256 of the token; this is what we store. */
export function hashOwnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time compare of sha256(token) against a stored hex hash.
 * Returns false (rather than throwing) for any malformed input or null hash.
 */
export function verifyOwnerToken(
  token: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) return false;
  if (typeof token !== "string" || token.length === 0) return false;
  const candidate = hashOwnerToken(token);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length || a.length !== 32) return false;
  return timingSafeEqual(a, b);
}
