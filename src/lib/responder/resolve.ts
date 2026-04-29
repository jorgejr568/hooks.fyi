import { logger } from "@/lib/log";
import type { ParsedRequest } from "@/lib/ingest/types";
import { matchRule } from "./match";
import { buildContext, render } from "./template";
import { MAX_DELAY_MS } from "./schema";
import type {
  ResponderConfig,
  ResolvedResponse,
  ResponseSpec,
} from "./types";

function clampStatus(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 100 || n > 599) {
    logger.warn({ raw }, "responder produced invalid status, defaulting to 500");
    return 500;
  }
  return n;
}

function clampDelay(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  if (ms > MAX_DELAY_MS) return MAX_DELAY_MS;
  return Math.floor(ms);
}

export function resolveResponse(
  config: ResponderConfig,
  parsed: ParsedRequest,
): ResolvedResponse {
  const ctx = buildContext(parsed);
  const spec: ResponseSpec =
    matchRule(config.rules, parsed.method, parsed.path) ?? config.default;

  const status = clampStatus(render(spec.status, ctx));
  const headers: Array<[string, string]> = [];
  for (const h of spec.headers) {
    const name = h.name.trim();
    if (name.length === 0) continue;
    headers.push([name, render(h.value, ctx)]);
  }
  const body = render(spec.body, ctx);
  const delayMs = clampDelay(spec.delayMs);
  return { status, headers, body, delayMs };
}
