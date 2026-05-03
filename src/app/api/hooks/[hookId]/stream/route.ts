import { prisma } from "@/lib/prisma";
import { hookEvents, type HookEvent } from "@/lib/events/hook-events";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { clientIp } from "@/lib/ingest/client-ip";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ hookId: string }> },
) {
  const { hookId } = await ctx.params;
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { id: true },
  });
  if (!hook) return new Response("not found", { status: 404 });

  const ip = clientIp(req, null);
  const limit = env.SSE_MAX_CONNECTIONS_PER_IP;
  const redis = limit > 0 ? getRedis() : null;
  const counterKey = `sse:conn:${ip}`;
  if (redis) {
    const next = await redis.incr(counterKey);
    if (next > limit) {
      await redis.decr(counterKey);
      return new Response("too many connections", { status: 429 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send("ready", { hookId });

      const unsubscribe = hookEvents.subscribe(hookId, (e: HookEvent) => send(e.type, e));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      const abort = async () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
        if (redis) {
          try { await redis.decr(counterKey); } catch { /* best-effort */ }
        }
      };
      req.signal.addEventListener("abort", abort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
