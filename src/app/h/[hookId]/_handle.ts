import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { parseRequest } from "@/lib/ingest/parse-request";
import { persistRequest } from "@/lib/ingest/persist-request";
import { hookEvents } from "@/lib/events/hook-events";
import { PayloadTooLargeError } from "@/lib/ingest/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleIngest(
  req: Request,
  hookId: string,
  segments: string[],
): Promise<Response> {
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }
  const hook = await prisma.hook.findUnique({ where: { id: hookId }, select: { id: true } });
  if (!hook) {
    return NextResponse.json({ error: "hook not found" }, { status: 404 });
  }

  const pathSuffix = segments.length > 0 ? `/${segments.join("/")}` : "/";

  let parsed;
  try {
    parsed = await parseRequest(req, pathSuffix, {
      maxBodyPreviewBytes: env.MAX_BODY_PREVIEW_BYTES,
      maxRequestBytes: env.MAX_REQUEST_BYTES,
      maxFileBytes: env.MAX_FILE_BYTES,
    });
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: "payload too large", limitBytes: err.limit },
        { status: 413 },
      );
    }
    throw err;
  }

  const result = await persistRequest({ hookId, parsed });
  hookEvents.publish(hookId, { type: "request.created", requestId: result.id });

  return NextResponse.json(
    { received: true, requestId: result.id, at: result.createdAt.toISOString() },
    { status: 200 },
  );
}
