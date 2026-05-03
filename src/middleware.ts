import { NextResponse, type NextRequest } from "next/server";

// Hosts Cloudflare's edge injects scripts from. We deploy behind Cloudflare,
// which adds the Web Analytics beacon to the response after we've sent it.
// `'strict-dynamic'` would force us to nonce the beacon (we can't — it's
// injected post-response), so we skip strict-dynamic and rely on host
// allowlisting instead. The nonce still locks down Next's own inline
// hydration scripts.
const CLOUDFLARE_SCRIPT_HOSTS = [
  "https://static.cloudflareinsights.com",
];

function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...CLOUDFLARE_SCRIPT_HOSTS,
  ].join(" ");
  const connectSrc = ["'self'", ...CLOUDFLARE_SCRIPT_HOSTS].join(" ");

  return (
    "default-src 'self'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'; ` +
    `script-src ${scriptSrc}; ` +
    `connect-src ${connectSrc}; ` +
    "frame-ancestors 'none'; " +
    "base-uri 'self';"
  );
}

function isHtmlLikePath(pathname: string): boolean {
  if (pathname.startsWith("/h/")) return false;
  if (pathname.startsWith("/api/files/")) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const htmlLike = isHtmlLikePath(url.pathname);

  // Generate a per-request nonce when we'll attach a CSP. Next.js reads
  // `x-nonce` from the forwarded request headers and stamps it onto the
  // inline scripts it emits for hydration/streaming.
  const nonce = htmlLike ? crypto.randomUUID().replace(/-/g, "") : null;

  const requestHeaders = new Headers(request.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");

  if (url.protocol === "https:") {
    res.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (nonce) {
    res.headers.set("content-security-policy", buildCsp(nonce));
  }

  return res;
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
