import { parseCronEnv } from "@/cron/env";
import { runCleanupSweep } from "@/cron/cleanup-stale-hooks";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/log";

const log = logger.child({ component: "cron" });

async function main() {
  const env = parseCronEnv(process.env);
  log.info(
    {
      retentionDays: env.STALE_HOOK_RETENTION_DAYS,
      intervalSeconds: env.CLEANUP_INTERVAL_SECONDS,
      batchSize: env.CLEANUP_BATCH_SIZE,
      runOnStart: env.RUN_ON_START,
    },
    "cron service starting",
  );

  let running = false;
  const tick = async () => {
    if (running) {
      log.warn("previous sweep still running; skipping tick");
      return;
    }
    running = true;
    try {
      await runCleanupSweep({
        retentionDays: env.STALE_HOOK_RETENTION_DAYS,
        batchSize: env.CLEANUP_BATCH_SIZE,
      });
    } catch (err) {
      log.error({ err: (err as Error).message }, "sweep crashed");
    } finally {
      running = false;
    }
  };

  if (env.RUN_ON_START) await tick();
  const handle = setInterval(tick, env.CLEANUP_INTERVAL_SECONDS * 1000);

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    clearInterval(handle);
    // Allow an in-flight sweep ~10s to finish before forcing exit.
    const deadline = Date.now() + 10_000;
    while (running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "cron boot failed");
  process.exit(1);
});
