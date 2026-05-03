import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { mintOwnerToken, hashOwnerToken } from "@/lib/auth/owner-token";
import { buildOwnerCookieHeader } from "@/lib/auth/owner-cookie";
import { enforceFixedWindow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/ingest/client-ip";
import type { CreateHookResponse } from "@/types/api";

const bodySchema = z.object({
  name: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req, null);
  const rl = await enforceFixedWindow({
    key: `rl:create:${ip}`,
    limit: env.RATE_LIMIT_CREATE_PER_IP,
    windowSeconds: env.RATE_LIMIT_CREATE_WINDOW_SECONDS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfter: rl.resetSeconds },
      {
        status: 429,
        headers: {
          "retry-after": String(rl.resetSeconds),
          "x-ratelimit-limit": String(rl.limit),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(rl.resetSeconds),
        },
      },
    );
  }

  let payload: z.infer<typeof bodySchema> = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      payload = bodySchema.parse(JSON.parse(text));
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ownerToken = mintOwnerToken();
  const hook = await prisma.hook.create({
    data: {
      name: payload.name ?? null,
      ownerTokenHash: hashOwnerToken(ownerToken),
    },
    select: { id: true, createdAt: true },
  });

  const response: CreateHookResponse = {
    id: hook.id,
    url: `${env.NEXT_PUBLIC_APP_URL}/h/${hook.id}`,
    dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/${hook.id}`,
    createdAt: hook.createdAt.toISOString(),
    ownerToken,
  };
  return NextResponse.json(response, {
    status: 201,
    headers: {
      "set-cookie": buildOwnerCookieHeader(hook.id, ownerToken),
    },
  });
}
