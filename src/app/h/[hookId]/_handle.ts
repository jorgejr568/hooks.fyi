import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/log";
import { parseRequest } from "@/lib/ingest/parse-request";
import { persistRequest } from "@/lib/ingest/persist-request";
import { hookEvents } from "@/lib/events/hook-events";
import { PayloadTooLargeError } from "@/lib/ingest/types";
import { safeParseResponderConfig, resolveResponse } from "@/lib/responder";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function handleIngest(
  req: Request,
  hookId: string,
  segments: string[],
): Promise<Response> {
  if (!UUID_RE.test(hookId)) {
    return NextResponse.json({ error: "invalid hook id" }, { status: 400 });
  }
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { id: true, responderConfig: true },
  });
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

  if (hook.responderConfig != null) {
    const cfg = safeParseResponderConfig(hook.responderConfig);
    if (cfg.success) {
      const resolved = resolveResponse(cfg.data, parsed);
      if (resolved.delayMs > 0) await sleep(resolved.delayMs);
      const headers = new Headers();
      let hasContentType = false;
      for (const [name, value] of resolved.headers) {
        headers.append(name, value);
        if (name.toLowerCase() === "content-type") hasContentType = true;
      }
      if (!hasContentType && resolved.body.length > 0) {
        headers.set("content-type", "text/plain; charset=utf-8");
      }
      return new Response(resolved.body, {
        status: resolved.status,
        headers,
      });
    }
    logger.error(
      { hookId, issues: cfg.error.issues },
      "stored responder config failed validation; falling back to default response",
    );
  }

  return NextResponse.json(
    {
      received: true,
      requestId: result.id,
      at: result.createdAt.toISOString(),
    },
    { status: 200 },
  );
}
