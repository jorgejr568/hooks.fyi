import { NextResponse, type NextRequest } from "next/server";

const HTML_LIKE_CSP =
  "default-src 'self'; " +
  "img-src 'self' data: blob:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self';";

function isHtmlLikePath(pathname: string): boolean {
  if (pathname.startsWith("/h/")) return false;
  if (pathname.startsWith("/api/files/")) return false;
  return true;
}

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

  if (isHtmlLikePath(url.pathname)) {
    res.headers.set("content-security-policy", HTML_LIKE_CSP);
  }

  return res;
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
