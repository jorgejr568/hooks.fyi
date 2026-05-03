import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/log";
import { verifyOwnerToken } from "./owner-token";
import { readOwnerCookie } from "./owner-cookie";

function readBearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Authorization gate for hook mutation endpoints.
 * Returns a `NextResponse` to short-circuit on failure, or `null` when the
 * caller should proceed.
 *
 * - Hook missing → null (downstream `update().catch(() => null)` produces 404).
 * - Hook has no ownerTokenHash (legacy) → null with a warn log; preserves the
 *   pre-fix UX for bins created before owner-token rollout.
 * - Token present and correct → null.
 * - Token absent or incorrect → 403 forbidden.
 */
export async function assertHookOwner(
  req: Request,
  hookId: string,
): Promise<NextResponse | null> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { ownerTokenHash: true },
  });
  if (!hook) return null;
  if (hook.ownerTokenHash == null) {
    logger.warn(
      { hookId, event: "legacy-unowned-hook" },
      "mutation against legacy hook with no owner token; allowing",
    );
    return null;
  }
  const provided = readBearer(req) ?? readOwnerCookie(req, hookId);
  if (!provided || !verifyOwnerToken(provided, hook.ownerTokenHash)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
