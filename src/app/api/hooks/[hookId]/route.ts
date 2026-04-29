import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePrefix } from "@/lib/s3";
import type { HookSummary } from "@/types/api";

export async function GET(_req: Request, ctx: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await ctx.params;
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!hook) return NextResponse.json({ error: "not found" }, { status: 404 });
  const out: HookSummary = {
    id: hook.id,
    name: hook.name,
    createdAt: hook.createdAt.toISOString(),
  };
  return NextResponse.json(out);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await ctx.params;
  const hook = await prisma.hook.findUnique({ where: { id: hookId }, select: { id: true } });
  if (!hook) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deletePrefix(`hooks/${hookId}/`);
  await prisma.hook.delete({ where: { id: hookId } });
  return NextResponse.json({ deleted: true });
}
