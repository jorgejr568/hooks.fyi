import { z } from "zod";

const schema = z.object({
  // Core deps reused from the web app — kept independent so the cron service
  // can run with a minimal config surface.
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Cron-specific knobs.
  STALE_HOOK_RETENTION_DAYS: z.coerce.number().int().min(1).default(15),
  CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(86_400),
  CLEANUP_BATCH_SIZE: z.coerce.number().int().min(1).max(10_000).default(500),
  RUN_ON_START: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_JSON: z.enum(["true", "false"]).optional(),
});

export type CronEnv = z.infer<typeof schema>;

export function parseCronEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined>,
): CronEnv {
  return schema.parse(source);
}
