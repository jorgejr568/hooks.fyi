import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectStream } from "@/lib/s3";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const inline = url.searchParams.get("inline") === "1";
  const fallbackName = att.fileName || fileName;
  const headers = new Headers({
    "content-type": att.contentType ?? "application/octet-stream",
    "content-length": String(att.size),
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(fallbackName)}"`,
    "cache-control": "private, max-age=0, no-store",
  });

  return new Response(obj.body, { status: 200, headers });
}
