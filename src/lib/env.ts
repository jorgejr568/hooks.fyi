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
  MAX_BODY_BYTES: z.coerce.number().int().positive().default(1_048_576),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(52_428_800),
});

export type Env = z.infer<typeof schema>;

// Lazy proxy so importing this module never crashes in environments where
// env vars aren't set yet (e.g. `next build` page-data collection inside Docker).
// During the Next.js build phase we substitute placeholder values so route
// handlers can be statically analyzed without real secrets.
const BUILD_PHASE = "phase-production-build";
const buildPlaceholder: Env = {
  DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "placeholder",
  S3_ACCESS_KEY_ID: "placeholder",
  S3_SECRET_ACCESS_KEY: "placeholder",
  S3_FORCE_PATH_STYLE: true,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  HOOK_PUBLIC_HOST: "localhost:3000",
  MAX_BODY_BYTES: 1_048_576,
  MAX_FILE_BYTES: 52_428_800,
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
