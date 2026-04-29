import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { RequestDetail } from "@/types/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ hookId: string; requestId: string }> },
) {
  const { hookId, requestId } = await ctx.params;
  const row = await prisma.request.findFirst({
    where: { id: requestId, hookId },
    include: {
      attachments: {
        select: {
          id: true,
          kind: true,
          fieldName: true,
          fileName: true,
          contentType: true,
          size: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const detail: RequestDetail = {
    id: row.id,
    method: row.method,
    path: row.path,
    contentType: row.contentType,
    bodySize: row.bodySize,
    attachmentCount: row.attachments.length,
    createdAt: row.createdAt.toISOString(),
    query: row.query as Record<string, string | string[]>,
    headers: row.headers as Record<string, string>,
    body: row.body,
    bodyTruncated: row.bodyTruncated,
    ip: row.ip,
    userAgent: row.userAgent,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      fieldName: a.fieldName,
      fileName: a.fileName,
      contentType: a.contentType,
      size: Number(a.size),
    })),
  };
  return NextResponse.json(detail);
}
