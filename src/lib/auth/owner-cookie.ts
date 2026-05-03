import { env } from "@/lib/env";

export const OWNER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function ownerCookieName(hookId: string): string {
  return `hfyi_o_${hookId}`;
}

export function buildOwnerCookieHeader(
  hookId: string,
  token: string,
): string {
  const isHttps = env.NEXT_PUBLIC_APP_URL.startsWith("https://");
  const parts = [
    `${ownerCookieName(hookId)}=${token}`,
    `Path=/api/hooks/${hookId}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${OWNER_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

export function readOwnerCookie(
  req: Request,
  hookId: string,
): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const target = ownerCookieName(hookId);
  for (const segment of raw.split(";")) {
    const trimmed = segment.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === target) return trimmed.slice(eq + 1);
  }
  return null;
}
