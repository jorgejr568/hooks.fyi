import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectStream } from "@/lib/s3";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await ctx.params;
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
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
  const fallbackName = att.fileName || "file";
  const headers = new Headers({
    "content-type": att.contentType ?? "application/octet-stream",
    "content-length": String(att.size),
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(fallbackName)}"`,
    "cache-control": "private, max-age=0, no-store",
  });

  return new Response(obj.body, { status: 200, headers });
}
