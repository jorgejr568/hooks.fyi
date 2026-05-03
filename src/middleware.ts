import { NextResponse, type NextRequest } from "next/server";

// Note: a Content-Security-Policy was attempted in earlier revisions but
// repeatedly conflicted with Cloudflare-injected inline scripts (Rocket
// Loader, Email Obfuscation, inline beacon shims) that arrive after our
// response leaves the origin and therefore cannot carry our per-request
// nonce. CSP3 modern-browser semantics also means 'unsafe-inline' is
// ignored once a nonce is present, so a fallback strategy doesn't help.
// Re-introducing CSP requires either disabling those Cloudflare features
// for the dashboard route, or pre-hashing the known injected scripts —
// tracked as a follow-up. The other four headers below cover the bulk
// of audit finding F9 (CVSS 3.7).

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const res = NextResponse.next();

  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");

  if (url.protocol === "https:") {
    res.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return res;
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
