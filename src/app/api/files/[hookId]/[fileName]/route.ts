import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectStream } from "@/lib/s3";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MIMEs the browser may render directly without becoming an XSS or
 *  active-content vector. Everything outside this set is forced to
 *  attachment + octet-stream when `inline=1` is requested. */
const INLINE_SAFE_MIMES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",          // see note below
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
  "text/plain",
]);
// image/svg+xml is included for usability; SVG can carry script. It is
// still served `inline`, but the global X-Content-Type-Options=nosniff
// header (Task 16) and a `Content-Security-Policy: sandbox` on the
// response below contain it.

function safeFilenameForHeader(name: string): string {
  // RFC 5987-safe encoding. Strip CR/LF/NUL just in case.
  return encodeURIComponent(name.replace(/[\r\n\0]/g, "_"));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ hookId: string; fileName: string }> },
) {
  const { hookId, fileName } = await ctx.params;
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }

  const dot = fileName.indexOf(".");
  const idPart = dot === -1 ? fileName : fileName.slice(0, dot);
  if (!UUID_RE.test(idPart)) {
    return NextResponse.json({ error: "invalid file id" }, { status: 400 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id: idPart, request: { hookId } },
    select: {
      s3Key: true,
      fileName: true,
      contentType: true,
      size: true,
    },
  });
  if (!att) return NextResponse.json({ error: "not found" }, { status: 404 });

  const obj = await getObjectStream(att.s3Key);
  if (!obj.body)
    return NextResponse.json({ error: "missing object" }, { status: 502 });

  const url = new URL(req.url);
  const wantInline = url.searchParams.get("inline") === "1";
  const userMime = (att.contentType ?? "").toLowerCase().split(";")[0].trim();
  const isSafeInline = wantInline && INLINE_SAFE_MIMES.has(userMime);

  const finalDisposition = isSafeInline ? "inline" : "attachment";
  const finalContentType = isSafeInline
    ? userMime
    : "application/octet-stream";
  const fallbackName = att.fileName || fileName;

  const headers = new Headers({
    "content-type": finalContentType,
    "content-length": String(att.size),
    "content-disposition": `${finalDisposition}; filename="${safeFilenameForHeader(fallbackName)}"`,
    "cache-control": "private, max-age=0, no-store",
    "x-content-type-options": "nosniff",
  });
  if (userMime === "image/svg+xml" && isSafeInline) {
    headers.set("content-security-policy", "sandbox");
  }

  return new Response(obj.body, { status: 200, headers });
}
