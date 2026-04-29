import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { CreateHookResponse } from "@/types/api";

const bodySchema = z.object({
  name: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  let payload: z.infer<typeof bodySchema> = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      payload = bodySchema.parse(JSON.parse(text));
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const hook = await prisma.hook.create({
    data: { name: payload.name ?? null },
    select: { id: true, createdAt: true },
  });

  const response: CreateHookResponse = {
    id: hook.id,
    url: `${env.NEXT_PUBLIC_APP_URL}/h/${hook.id}`,
    dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/${hook.id}`,
    createdAt: hook.createdAt.toISOString(),
  };
  return NextResponse.json(response, { status: 201 });
}
