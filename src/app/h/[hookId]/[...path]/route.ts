import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { parseRequest } from "@/lib/ingest/parse-request";
import { persistRequest } from "@/lib/ingest/persist-request";
import { hookEvents } from "@/lib/events/hook-events";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(
  req: Request,
  ctx: { params: Promise<{ hookId: string; path?: string[] }> },
) {
  const { hookId, path } = await ctx.params;
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }
  const hook = await prisma.hook.findUnique({ where: { id: hookId }, select: { id: true } });
  if (!hook) {
    return NextResponse.json({ error: "hook not found" }, { status: 404 });
  }

  const segments = path ?? [];
  const pathSuffix = segments.length > 0 ? `/${segments.join("/")}` : "/";

  const parsed = await parseRequest(req, pathSuffix, {
    maxBodyBytes: env.MAX_BODY_BYTES,
    maxFileBytes: env.MAX_FILE_BYTES,
  });

  const result = await persistRequest({ hookId, parsed });
  hookEvents.publish(hookId, { type: "request.created", requestId: result.id });

  return NextResponse.json(
    { received: true, requestId: result.id, at: result.createdAt.toISOString() },
    { status: 200 },
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
