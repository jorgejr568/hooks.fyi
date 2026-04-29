import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  responderConfigSchema,
  type ResponderConfig,
} from "@/lib/responder";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const putBodySchema = z.object({
  responderConfig: responderConfigSchema.nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ hookId: string }> },
) {
  const { hookId } = await ctx.params;
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { responderConfig: true },
  });
  if (!hook) {
    return NextResponse.json({ error: "hook not found" }, { status: 404 });
  }
  return NextResponse.json({
    responderConfig: hook.responderConfig as ResponderConfig | null,
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ hookId: string }> },
) {
  const { hookId } = await ctx.params;
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = putBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid responder config", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await prisma.hook
    .update({
      where: { id: hookId },
      data: {
        responderConfig:
          parsed.data.responderConfig === null
            ? Prisma.JsonNull
            : parsed.data.responderConfig,
      },
      select: { responderConfig: true },
    })
    .catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "hook not found" }, { status: 404 });
  }
  return NextResponse.json({
    responderConfig: updated.responderConfig as ResponderConfig | null,
  });
}
