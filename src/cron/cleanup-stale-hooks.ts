import { prisma } from "@/lib/prisma";
import { deletePrefix } from "@/lib/s3";
import { logger } from "@/lib/log";

const log = logger.child({ component: "cron-cleanup" });

export async function findStaleHookIds(args: {
  retentionDays: number;
  limit: number;
}): Promise<string[]> {
  const threshold = new Date(Date.now() - args.retentionDays * 86_400_000);
  // A hook is "stale" when its createdAt is older than the threshold AND it
  // has no request newer than the threshold. Implemented as a single SQL
  // statement so we don't pull every hook into memory.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT h.id
    FROM "Hook" h
    WHERE h."createdAt" < ${threshold}
      AND NOT EXISTS (
        SELECT 1 FROM "Request" r
        WHERE r."hookId" = h.id
          AND r."createdAt" >= ${threshold}
      )
    ORDER BY h."createdAt" ASC
    LIMIT ${args.limit}
  `;
  return rows.map((r) => r.id);
}

export async function deleteHookSafely(args: {
  hookId: string;
  retentionDays: number;
}): Promise<{ deleted: boolean; s3Cleaned: boolean }> {
  const threshold = new Date(Date.now() - args.retentionDays * 86_400_000);

  // Guarded DELETE: only succeeds if no request newer than threshold exists.
  // Returns the rowcount via $executeRaw, which beats select-then-delete races.
  const deletedCount = await prisma.$executeRaw`
    DELETE FROM "Hook" h
    WHERE h.id = ${args.hookId}::uuid
      AND h."createdAt" < ${threshold}
      AND NOT EXISTS (
        SELECT 1 FROM "Request" r
        WHERE r."hookId" = h.id
          AND r."createdAt" >= ${threshold}
      )
  `;

  if (deletedCount === 0) {
    log.debug({ hookId: args.hookId }, "skip: hook no longer stale or missing");
    return { deleted: false, s3Cleaned: false };
  }

  // DB row is gone (cascade took Requests + Attachments with it). Now wipe S3.
  // If this fails the prefix is orphaned; nobody can write to it anymore so a
  // future sweep job (or manual mc rb) can reconcile. We log and swallow.
  try {
    await deletePrefix(`hooks/${args.hookId}/`);
    return { deleted: true, s3Cleaned: true };
  } catch (err) {
    log.error(
      { hookId: args.hookId, err: (err as Error).message },
      "s3 prefix delete failed; hook row already removed",
    );
    return { deleted: true, s3Cleaned: false };
  }
}

export interface SweepResult {
  candidates: number;
  deleted: number;
  skipped: number;
  s3Failures: number;
  durationMs: number;
}

export async function runCleanupSweep(args: {
  retentionDays: number;
  batchSize: number;
}): Promise<SweepResult> {
  const started = Date.now();
  const ids = await findStaleHookIds({
    retentionDays: args.retentionDays,
    limit: args.batchSize,
  });

  let deleted = 0;
  let skipped = 0;
  let s3Failures = 0;

  for (const id of ids) {
    const r = await deleteHookSafely({
      hookId: id,
      retentionDays: args.retentionDays,
    });
    if (r.deleted) {
      deleted++;
      if (!r.s3Cleaned) s3Failures++;
    } else {
      skipped++;
    }
  }

  const result: SweepResult = {
    candidates: ids.length,
    deleted,
    skipped,
    s3Failures,
    durationMs: Date.now() - started,
  };
  log.info(result, "cleanup sweep complete");
  return result;
}
