import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { RequestSummary } from "@/types/api";

const PAGE_SIZE = 50;

export async function GET(req: Request, ctx: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await ctx.params;
  const hook = await prisma.hook.findUnique({ where: { id: hookId }, select: { id: true } });
  if (!hook) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const since = url.searchParams.get("since"); // for live polling: ISO timestamp

  const where: { hookId: string; createdAt?: { gt: Date } } = { hookId };
  if (since) {
    const ts = new Date(since);
    if (!Number.isNaN(ts.getTime())) where.createdAt = { gt: ts };
  }

  const rows = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      method: true,
      path: true,
      contentType: true,
      bodySize: true,
      createdAt: true,
      _count: { select: { attachments: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const items: RequestSummary[] = page.map((r) => ({
    id: r.id,
    method: r.method,
    path: r.path,
    contentType: r.contentType,
    bodySize: r.bodySize,
    attachmentCount: r._count.attachments,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
