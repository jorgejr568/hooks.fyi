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

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
