import { z } from "zod";

const schema = z.object({
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
  NEXT_PUBLIC_APP_URL: z.string().url(),
  HOOK_PUBLIC_HOST: z.string().min(1),
  // Bytes of the body kept inline in Postgres (Request.body). Bodies bigger
  // than this overflow to S3 as a synthetic RAW_BODY attachment.
  MAX_BODY_PREVIEW_BYTES: z.coerce.number().int().positive().default(262_144), // 256 KB
  // Hard ceiling on a single request's total body size. Anything larger is
  // rejected with HTTP 413 — protects the worker from OOM.
  MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(104_857_600), // 100 MB
  // Per-file cap inside multipart/form-data and for body overflow uploads.
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(52_428_800), // 50 MB
  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_JSON: z.enum(["true", "false"]).optional(),
  // Rate limiting (per-hook, fixed window, backed by Redis).
  // When REDIS_URL is unset the limiter is a no-op — useful in tests/dev.
  REDIS_URL: z.string().url().optional(),
  // Max requests allowed per hook in each window. Set to 0 to disable.
  RATE_LIMIT_PER_HOOK: z.coerce.number().int().nonnegative().default(100),
  // Window size in seconds. Default is one minute → "100/min" out of the box.
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  // Max POST /api/hooks per IP in each window. Set to 0 to disable.
  RATE_LIMIT_CREATE_PER_IP: z.coerce.number().int().nonnegative().default(20),
  RATE_LIMIT_CREATE_WINDOW_SECONDS: z
    .coerce
    .number()
    .int()
    .positive()
    .default(3600), // 20/hour by default
  /**
   * Comma-separated list of CIDRs or exact IPs whose X-Forwarded-For we trust.
   * Empty (default) means do not trust XFF; client IP comes from the network
   * peer / x-real-ip when present.
   */
  TRUSTED_PROXY_IPS: z.string().default(""),
  // Per-IP cap on concurrent SSE stream connections. 0 disables the cap.
  SSE_MAX_CONNECTIONS_PER_IP: z.coerce.number().int().nonnegative().default(20),
});

export type Env = z.infer<typeof schema>;

// Lazy proxy so importing this module never crashes in environments where
// env vars aren't set yet (e.g. `next build` page-data collection inside Docker).
// During the Next.js build phase we substitute placeholder values so route
// handlers can be statically analyzed without real secrets.
const BUILD_PHASE = "phase-production-build";
const buildPlaceholder: Env = {
  DATABASE_URL:
    "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "placeholder",
  S3_ACCESS_KEY_ID: "placeholder",
  S3_SECRET_ACCESS_KEY: "placeholder",
  S3_FORCE_PATH_STYLE: true,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  HOOK_PUBLIC_HOST: "localhost:3000",
  MAX_BODY_PREVIEW_BYTES: 262_144,
  MAX_REQUEST_BYTES: 104_857_600,
  MAX_FILE_BYTES: 52_428_800,
  LOG_LEVEL: "info",
  LOG_JSON: undefined,
  REDIS_URL: undefined,
  RATE_LIMIT_PER_HOOK: 100,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_CREATE_PER_IP: 20,
  RATE_LIMIT_CREATE_WINDOW_SECONDS: 3600,
  TRUSTED_PROXY_IPS: "",
  SSE_MAX_CONNECTIONS_PER_IP: 20,
};

let cached: Env | null = null;
function load(): Env {
  if (cached) return cached;
  if (process.env.NEXT_PHASE === BUILD_PHASE) {
    cached = buildPlaceholder;
    return cached;
  }
  cached = schema.parse(process.env);
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop) {
    return load()[prop as keyof Env];
  },
}) as Env;
